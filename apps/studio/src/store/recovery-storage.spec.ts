import { Either } from 'effect';
import { studioVersion } from '../version.js';
import { FileLifecycle, type RetainedSource } from './state.js';
import {
  foreignSource,
  nativeSource,
  restorableSnapshot,
  sampleModel,
  secondDiagram,
  twoDiagramModel,
} from './store.fixtures.js';
import {
  localRecoveryStorage,
  recoverySnapshot,
  recoveryStorageKey,
  RecoveryStorageFailure,
} from './recovery-storage.js';

const opened = (source: RetainedSource = foreignSource): FileLifecycle =>
  FileLifecycle.Opened({ name: 'model.json', source });

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    backend: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    },
  };
}

function failureFor(raw: string) {
  const memory = memoryStorage();
  memory.values.set(recoveryStorageKey, raw);
  const loaded = localRecoveryStorage(() => memory.backend).load();
  return Either.isLeft(loaded) ? loaded.left : undefined;
}

const version1Snapshot = JSON.stringify({
  version: 1,
  present: sampleModel,
  dirty: false,
  file: { _tag: 'NoFile' },
});

const flowWithoutDirection = {
  kind: 'flow',
  id: 'flow-reads',
  name: 'reads',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  source: { kind: 'attached', element: 'actor-reader' },
  target: { kind: 'attached', element: 'process-studio' },
  waypoints: [],
};

const documentWithoutDirection = {
  formatVersion: 1,
  metadata: { title: 'Earlier', owner: '', description: '', contributors: [] },
  diagrams: [
    {
      id: 'diagram-main',
      title: 'Main',
      elements: [
        {
          kind: 'actor',
          id: 'actor-reader',
          name: 'Reader',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 0, y: 0 },
          size: { width: 120, height: 60 },
        },
        {
          kind: 'process',
          id: 'process-studio',
          name: 'Studio',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 200, y: 0 },
          size: { width: 120, height: 60 },
        },
        flowWithoutDirection,
      ],
    },
  ],
  threats: [],
  lastIssuedThreatNumber: 0,
  mitigations: [],
  assumptions: [],
};

const documentWithElementLinkedAssumption = {
  ...documentWithoutDirection,
  threats: [
    {
      id: 'threat-spoofed-reader',
      number: 1,
      title: 'Spoofed reader',
      category: { methodology: 'STRIDE', category: 'spoofing' },
      severity: 'high',
      status: 'open',
      description: '',
      mitigation: '',
      elements: ['actor-reader'],
    },
  ],
  lastIssuedThreatNumber: 1,
  assumptions: [
    {
      id: 'assumption-signed-in',
      prose: 'Every reader signs in.',
      status: 'valid',
      elements: ['actor-reader', 'process-studio'],
      threats: ['threat-spoofed-reader'],
    },
  ],
};

describe('local recovery storage', () => {
  it('loads nothing when the namespaced key is absent', () => {
    const memory = memoryStorage();
    const storage = localRecoveryStorage(() => memory.backend);

    expect(storage.load()).toEqual(Either.right(undefined));
    expect(recoveryStorageKey).toContain('saerskriven:studio:');
  });

  it('replaces the one versioned snapshot and gives the model back on load', () => {
    const memory = memoryStorage();
    const storage = localRecoveryStorage(() => memory.backend);
    const first = recoverySnapshot(sampleModel, false, opened());
    const latest = recoverySnapshot(sampleModel, true, opened(nativeSource));

    expect(Either.isRight(storage.replace(first))).toBe(true);
    expect(storage.load()).toEqual(
      Either.right(restorableSnapshot(sampleModel, false, opened())),
    );
    expect(Either.isRight(storage.replace(latest))).toBe(true);

    const raw = memory.values.get(recoveryStorageKey) ?? '';
    expect(JSON.parse(raw)).toMatchObject({
      version: 2,
      dirty: true,
      writtenBy: { studioVersion },
    });
    expect(raw).not.toContain('"past"');
    expect(raw).not.toContain('"future"');
    expect(raw).not.toContain('"selection"');
    expect(raw).not.toContain('"renaming"');
    expect(raw).not.toContain('"lastFailure"');
    expect(storage.load()).toEqual(
      Either.right(restorableSnapshot(sampleModel, true, opened(nativeSource))),
    );
  });

  it('keeps the diagram on screen, and loads a snapshot written before it was kept', () => {
    const memory = memoryStorage();
    const storage = localRecoveryStorage(() => memory.backend);
    const shown = recoverySnapshot(
      twoDiagramModel,
      false,
      opened(),
      secondDiagram,
    );

    expect(Either.isRight(storage.replace(shown))).toBe(true);
    expect(storage.load()).toEqual(
      Either.right(
        restorableSnapshot(twoDiagramModel, false, opened(), secondDiagram),
      ),
    );

    storage.replace(recoverySnapshot(twoDiagramModel, false, opened()));
    const earlier = storage.load();
    expect(Either.isRight(earlier)).toBe(true);
    expect(Either.getOrThrow(earlier)?.activeDiagram).toBeUndefined();
  });

  it('restores a document written before the format declared a key, on the mapping default', () => {
    const memory = memoryStorage();
    memory.values.set(
      recoveryStorageKey,
      JSON.stringify({
        version: 2,
        document: documentWithoutDirection,
        writtenBy: { studioVersion: '0.2.1' },
        dirty: false,
        file: { _tag: 'NoFile' },
      }),
    );
    const loaded = localRecoveryStorage(() => memory.backend).load();

    expect(Either.isRight(loaded)).toBe(true);
    expect(
      Either.getOrThrow(loaded)?.present.diagrams[0].elements.find(
        (element) => element.kind === 'flow',
      ),
    ).toMatchObject({ bidirectional: false });
  });

  it('restores a document whose assumption links elements, without the element links', () => {
    const memory = memoryStorage();
    memory.values.set(
      recoveryStorageKey,
      JSON.stringify({
        version: 2,
        document: documentWithElementLinkedAssumption,
        writtenBy: { studioVersion: '0.4.0' },
        dirty: false,
        file: { _tag: 'NoFile' },
      }),
    );
    const loaded = localRecoveryStorage(() => memory.backend).load();

    expect(Either.getOrThrow(loaded)?.present.assumptions).toEqual([
      {
        id: 'assumption-signed-in',
        prose: 'Every reader signs in.',
        status: 'valid',
        threats: ['threat-spoofed-reader'],
      },
    ]);
  });

  it('rejects a version 1 snapshot, saying an earlier release wrote it', () => {
    const older = failureFor(version1Snapshot);

    expect(older?._tag).toBe('Rejected');
    expect(older?.reason).toContain('earlier release');
    expect(older?.reason).not.toBe(failureFor('{}')?.reason);
  });

  it.each([
    ['malformed JSON', '{'],
    [
      'an unsupported later version',
      JSON.stringify({
        version: 3,
        document: documentWithoutDirection,
        writtenBy: { studioVersion },
        dirty: false,
        file: { _tag: 'NoFile' },
      }),
    ],
    [
      'a document the model refuses',
      JSON.stringify({
        version: 2,
        document: {
          ...documentWithoutDirection,
          threats: [
            {
              id: 'threat-1',
              number: 1,
              title: 'Attached to nothing',
              category: { methodology: 'STRIDE', category: 'spoofing' },
              severity: 'medium',
              status: 'open',
              description: '',
              mitigation: '',
              elements: ['element-missing'],
            },
          ],
          lastIssuedThreatNumber: 1,
        },
        writtenBy: { studioVersion },
        dirty: false,
        file: { _tag: 'NoFile' },
      }),
    ],
    [
      'an invalid document',
      JSON.stringify({
        version: 2,
        document: {},
        writtenBy: { studioVersion },
        dirty: false,
        file: { _tag: 'NoFile' },
      }),
    ],
    [
      'an invalid retained source',
      JSON.stringify({
        version: 2,
        document: documentWithoutDirection,
        writtenBy: { studioVersion },
        dirty: false,
        file: {
          _tag: 'Opened',
          name: 'model.json',
          source: { format: 'threat-dragon', document: {} },
        },
      }),
    ],
  ])('rejects %s without throwing', (_case, raw) => {
    const memory = memoryStorage();
    memory.values.set(recoveryStorageKey, raw);
    const loaded = localRecoveryStorage(() => memory.backend).load();

    expect(loaded).toEqual(
      Either.left(expect.objectContaining({ _tag: 'Rejected' })),
    );
  });

  it('reports disabled storage for load, replace, and clear', () => {
    const refused = localRecoveryStorage(() => {
      throw new Error('storage disabled');
    });
    const snapshot = recoverySnapshot(sampleModel, true, opened());

    for (const outcome of [
      refused.load(),
      refused.replace(snapshot),
      refused.clear(),
    ]) {
      expect(outcome).toEqual(
        Either.left(
          RecoveryStorageFailure.Unavailable({ reason: 'storage disabled' }),
        ),
      );
    }
  });

  it('clears the current snapshot', () => {
    const memory = memoryStorage();
    const storage = localRecoveryStorage(() => memory.backend);
    storage.replace(recoverySnapshot(sampleModel, true, opened()));

    expect(Either.isRight(storage.clear())).toBe(true);
    expect(memory.values.has(recoveryStorageKey)).toBe(false);
  });
});
