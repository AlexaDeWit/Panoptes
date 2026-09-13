import { readAnyFormat, readLimits } from '@saerskriven/formats';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  dragonFile,
  editableTree,
  modelFile,
  unclaimedFile,
  type EditInput,
} from './edit.fixtures.js';
import { editArgumentsSchema, editModel, renderEdit } from './edit.js';
import { revisionOf } from './revision.js';
import { openWorkspace } from './workspace.js';

const staleRevision = `sha256:${'0'.repeat(64)}`;

const renaming: EditInput = {
  op: 'rename_element',
  element: 'element-db',
  name: 'Order store',
};

const addedMitigation = (
  threat: string,
  prose = 'Record every write with the caller.',
): EditInput => ({
  op: 'add_mitigation',
  mitigation: {
    id: 'mitigation-audit-log',
    title: 'Audit log',
    prose,
    status: 'proposed',
    threats: [threat],
  },
});

const ecluseThreat = '0ec10e5e-0000-4000-8000-00000000010c';

const attempt = () => {
  const tree = editableTree();
  const workspace = Either.getOrThrow(openWorkspace({ root: tree.root }));
  const bytes = (file: string): Buffer => readFileSync(join(tree.root, file));
  return {
    bytes,
    edit: (file: string, revision: string, edits: readonly EditInput[]) =>
      editModel(
        workspace,
        editArgumentsSchema.parse({ file, revision, edits }),
      ),
  };
};

const revisionIn = (
  attempted: ReturnType<typeof attempt>,
  file: string,
): string => revisionOf(attempted.bytes(file));

describe('what a refused edit leaves on disk', () => {
  it('writes nothing when the model refuses one edit of the batch', () => {
    const attempted = attempt();
    const before = attempted.bytes(modelFile);
    const refused = attempted.edit(
      modelFile,
      revisionIn(attempted, modelFile),
      [renaming, { op: 'remove_element', element: 'element-absent' }],
    );
    expect(attempted.bytes(modelFile)).toEqual(before);
    expect(Either.isLeft(refused) ? refused.left : []).toEqual([
      'The edit at index 1 was refused, so none of the batch was applied and the file is as it was.',
      'The model holds no element "element-absent".',
    ]);
  });

  it('writes nothing when the revision no longer matches the file', () => {
    const attempted = attempt();
    const before = attempted.bytes(modelFile);
    const refused = attempted.edit(modelFile, staleRevision, [renaming]);
    expect(attempted.bytes(modelFile)).toEqual(before);
    expect(
      Either.isLeft(refused) ? refused.left.join('\n') : 'the edit was applied',
    ).toContain('changed since the read this call quoted');
  });

  it('writes nothing when no codec claims the file', () => {
    const attempted = attempt();
    const before = attempted.bytes(unclaimedFile);
    const refused = attempted.edit(
      unclaimedFile,
      revisionIn(attempted, unclaimedFile),
      [renaming],
    );
    expect(attempted.bytes(unclaimedFile)).toEqual(before);
    expect(
      Either.isLeft(refused) ? refused.left.join('\n') : 'the edit was applied',
    ).toContain('was not read');
  });

  it('writes nothing when the edited model would be past the size this server reads', () => {
    const attempted = attempt();
    const before = attempted.bytes(modelFile);
    const refused = attempted.edit(
      modelFile,
      revisionIn(attempted, modelFile),
      [
        addedMitigation(
          'threat-tamper-order',
          'x'.repeat(readLimits.maxTextBytes),
        ),
      ],
    );
    expect(attempted.bytes(modelFile)).toEqual(before);
    expect(
      Either.isLeft(refused) ? refused.left.join('\n') : 'the edit was applied',
    ).toContain('past the size this server reads');
  });
});

describe('what an applied edit writes', () => {
  it('reports the file, the count and the handle the next write quotes', () => {
    const attempted = attempt();
    const quoted = revisionIn(attempted, modelFile);
    const applied = attempted.edit(modelFile, quoted, [renaming]);
    const written = revisionIn(attempted, modelFile);
    expect(Either.getOrUndefined(applied)).toEqual({
      file: modelFile,
      format: 'saerskriven-yaml',
      revision: written,
      applied: 1,
      culled: [],
      divergences: [],
    });
    expect(written).not.toEqual(quoted);
  });

  it('reads as the lines a text result carries', () => {
    const attempted = attempt();
    const applied = attempted.edit(
      modelFile,
      revisionIn(attempted, modelFile),
      [renaming],
    );
    expect(
      Either.match(applied, { onLeft: (lines) => lines, onRight: renderEdit }),
    ).toEqual([
      'edits applied: 1',
      'culled:',
      'No record culled.',
      `file: ${modelFile}`,
      'format: saerskriven-yaml',
      `revision: ${revisionIn(attempted, modelFile)}`,
      'divergences:',
      'No divergence recorded.',
    ]);
  });

  it('keeps a Threat Dragon file in its own format and reports what it cannot hold', () => {
    const attempted = attempt();
    const applied = attempted.edit(
      dragonFile,
      revisionIn(attempted, dragonFile),
      [addedMitigation(ecluseThreat)],
    );
    const reread = readAnyFormat(attempted.bytes(dragonFile).toString('utf8'));
    expect(Either.getOrUndefined(applied)?.format).toEqual('threat-dragon');
    expect(Either.getOrUndefined(applied)?.divergences).toEqual([
      {
        subject: { kind: 'mitigation', id: 'mitigation-audit-log' },
        detail:
          'the mitigation "Audit log", which the format keeps no record of',
        reason: 'unrepresentable',
      },
    ]);
    expect(Either.getOrUndefined(reread)?.format).toEqual('threat-dragon');
  });
});

describe('the records a batch culls', () => {
  it('names each record a removed threat took with it, in its lines too', () => {
    const attempted = attempt();
    const applied = attempted.edit(
      modelFile,
      revisionIn(attempted, modelFile),
      [{ op: 'remove_threat', threat: 'threat-tamper-order' }],
    );
    expect(Either.getOrUndefined(applied)?.culled).toEqual([
      { kind: 'mitigation', id: 'mitigation-tls' },
      { kind: 'assumption', id: 'assumption-managed-db' },
    ]);
    expect(
      Either.match(applied, { onLeft: (lines) => lines, onRight: renderEdit }),
    ).toEqual(
      expect.arrayContaining([
        'mitigation "mitigation-tls"',
        'assumption "assumption-managed-db"',
      ]),
    );
  });

  it('names neither an explicitly removed record nor one the batch added and culled', () => {
    const attempted = attempt();
    const applied = attempted.edit(
      modelFile,
      revisionIn(attempted, modelFile),
      [
        { op: 'remove_mitigation', mitigation: 'mitigation-tls' },
        addedMitigation('threat-tamper-order'),
        { op: 'remove_assumption', assumption: 'assumption-managed-db' },
        { op: 'remove_threat', threat: 'threat-tamper-order' },
      ],
    );
    expect(Either.getOrUndefined(applied)?.culled).toEqual([]);
  });
});

const tlsOn = (threat: string): EditInput => ({
  op: 'add_mitigation',
  mitigation: {
    id: 'mitigation-tls',
    title: 'TLS on the order flow',
    prose: 'Terminate TLS at the perimeter and pin the certificate.',
    status: 'proposed',
    threats: [threat],
  },
});

describe('the records a batch culls and adds back', () => {
  const replay: EditInput = {
    op: 'add_threat',
    threat: {
      id: 'threat-replay',
      title: 'Order replay',
      category: { methodology: 'STRIDE', category: 'repudiation' },
      severity: 'low',
      status: 'open',
      description: '',
      mitigation: '',
      elements: [],
    },
  };

  const culledBy = (edits: readonly EditInput[]) => {
    const attempted = attempt();
    return Either.getOrUndefined(
      attempted.edit(modelFile, revisionIn(attempted, modelFile), edits),
    )?.culled;
  };

  it('names a record a removed threat culled, though a later edit adds it back', () => {
    expect(
      culledBy([
        replay,
        { op: 'remove_threat', threat: 'threat-tamper-order' },
        tlsOn('threat-replay'),
      ]),
    ).toEqual([
      { kind: 'mitigation', id: 'mitigation-tls' },
      { kind: 'assumption', id: 'assumption-managed-db' },
    ]);
  });

  it('names a record the file held that the batch removed, added back and then culled', () => {
    expect(
      culledBy([
        { op: 'remove_mitigation', mitigation: 'mitigation-tls' },
        tlsOn('threat-tamper-order'),
        { op: 'remove_assumption', assumption: 'assumption-managed-db' },
        { op: 'remove_threat', threat: 'threat-tamper-order' },
      ]),
    ).toEqual([{ kind: 'mitigation', id: 'mitigation-tls' }]);
  });
});

describe('what the flow direction and metadata ops write', () => {
  it('makes a flow bidirectional and keeps the threats attached to it', () => {
    const attempted = attempt();
    attempted.edit(modelFile, revisionIn(attempted, modelFile), [
      {
        op: 'set_flow_direction',
        element: 'element-order-flow',
        bidirectional: true,
      },
    ]);
    const model = Either.getOrUndefined(
      readAnyFormat(attempted.bytes(modelFile).toString('utf8')),
    )?.model;
    expect(
      model?.diagrams[0].elements.find(
        (element) => element.id === 'element-order-flow',
      ),
    ).toMatchObject({ bidirectional: true });
    expect(
      model?.threats.find((threat) => threat.id === 'threat-tamper-order')
        ?.elements,
    ).toContain('element-order-flow');
  });

  const metadata = {
    title: 'Écluse, second pass',
    owner: 'Jonas Lindqvist',
    description: 'Reviewed with the platform team.\nSecond line.',
    contributors: ['Alexandra de Wit', 'Jonas Lindqvist', ''],
  };

  for (const file of [modelFile, dragonFile]) {
    it(`carries every metadata field through a ${file} write and back`, () => {
      const attempted = attempt();
      const applied = attempted.edit(file, revisionIn(attempted, file), [
        { op: 'set_model_metadata', ...metadata },
      ]);
      const reread = readAnyFormat(attempted.bytes(file).toString('utf8'));
      expect(Either.getOrUndefined(reread)?.model.metadata).toEqual(metadata);
      expect(
        Either.getOrUndefined(applied)?.divergences.filter(
          (divergence) => divergence.subject.kind === 'model',
        ),
      ).toEqual([]);
    });
  }
});
