import { Either } from 'effect';
import { FileLifecycle, type RetainedSource } from './state.js';
import {
  foreignSource,
  nativeSource,
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

describe('local recovery storage', () => {
  it('loads nothing when the namespaced key is absent', () => {
    const memory = memoryStorage();
    const storage = localRecoveryStorage(() => memory.backend);

    expect(storage.load()).toEqual(Either.right(undefined));
    expect(recoveryStorageKey).toContain('saerskriven:studio:');
  });

  it('replaces the one versioned snapshot and validates it on load', () => {
    const memory = memoryStorage();
    const storage = localRecoveryStorage(() => memory.backend);
    const first = recoverySnapshot(sampleModel, false, opened());
    const latest = recoverySnapshot(sampleModel, true, opened(nativeSource));

    expect(Either.isRight(storage.replace(first))).toBe(true);
    expect(storage.load()).toEqual(Either.right(first));
    expect(Either.isRight(storage.replace(latest))).toBe(true);

    const raw = memory.values.get(recoveryStorageKey) ?? '';
    expect(JSON.parse(raw)).toMatchObject({ version: 1, dirty: true });
    expect(raw).not.toContain('"past"');
    expect(raw).not.toContain('"future"');
    expect(raw).not.toContain('"selection"');
    expect(raw).not.toContain('"renaming"');
    expect(raw).not.toContain('"lastFailure"');
    expect(storage.load()).toEqual(Either.right(latest));
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
    expect(storage.load()).toEqual(Either.right(shown));

    memory.values.set(
      recoveryStorageKey,
      JSON.stringify({
        version: 1,
        present: twoDiagramModel,
        dirty: false,
        file: { _tag: 'NoFile' },
      }),
    );
    const earlier = storage.load();
    expect(Either.isRight(earlier)).toBe(true);
    expect(Either.getOrThrow(earlier)?.activeDiagram).toBeUndefined();
  });

  it.each([
    ['malformed JSON', '{'],
    [
      'an unsupported version',
      JSON.stringify({
        version: 2,
        present: sampleModel,
        dirty: false,
        file: { _tag: 'NoFile' },
      }),
    ],
    [
      'an invalid model',
      JSON.stringify({
        version: 1,
        present: {},
        dirty: false,
        file: { _tag: 'NoFile' },
      }),
    ],
    [
      'an invalid retained source',
      JSON.stringify({
        version: 1,
        present: sampleModel,
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
