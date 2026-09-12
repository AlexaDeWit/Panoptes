import { readAnyFormat } from '@saerskriven/formats';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createArgumentsSchema, createModel } from './create.js';
import { editableTree, modelFile } from './edit.fixtures.js';
import { revisionOf } from './revision.js';
import { openWorkspace } from './workspace.js';

const created = (root: string, args: Record<string, unknown>) =>
  createModel(
    Either.getOrThrow(openWorkspace({ root })),
    createArgumentsSchema.parse(args),
  );

describe('starting a model', () => {
  it('writes the native format, with the handle the first edit quotes back', () => {
    const tree = editableTree();
    const answer = created(tree.root, {
      file: 'new-model.yaml',
      title: 'Payments',
      owner: 'Alexandra de Wit',
    });
    expect(Either.getOrUndefined(answer)).toEqual({
      file: 'new-model.yaml',
      format: 'saerskriven-yaml',
      revision: revisionOf(readFileSync(join(tree.root, 'new-model.yaml'))),
      divergences: [],
    });
  });

  it('writes the title and owner the call gave it, and nothing else', () => {
    const tree = editableTree();
    created(tree.root, { file: 'new-model.yaml', title: 'Payments' });
    const read = readAnyFormat(
      readFileSync(join(tree.root, 'new-model.yaml'), 'utf8'),
    );
    expect(Either.getOrUndefined(read)?.model).toEqual(
      expect.objectContaining({
        metadata: {
          title: 'Payments',
          owner: '',
          description: '',
          contributors: [],
        },
        diagrams: [],
        threats: [],
        mitigations: [],
        assumptions: [],
        lastIssuedThreatNumber: 0,
      }),
    );
  });

  it('refuses a path already holding a file, leaving its bytes alone', () => {
    const tree = editableTree();
    const before = readFileSync(join(tree.root, modelFile));
    const refused = created(tree.root, { file: modelFile, title: 'Payments' });
    expect(readFileSync(join(tree.root, modelFile))).toEqual(before);
    expect(
      Either.isLeft(refused) ? refused.left.join('\n') : 'the file was written',
    ).toContain('is already there');
  });

  it('refuses a path outside the root', () => {
    const tree = editableTree();
    const refused = created(tree.root, {
      file: '../escaped.yaml',
      title: 'Payments',
    });
    expect(
      Either.isLeft(refused) ? refused.left.join('\n') : 'the file was written',
    ).toContain('is outside the root this server may read');
  });
});
