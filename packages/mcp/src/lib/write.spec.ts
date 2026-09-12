import { Either } from 'effect';
import { chmodSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { editableTree, modelFile } from './edit.fixtures.js';
import { revisionOf } from './revision.js';
import {
  WriteFailure,
  createdFile,
  namedFile,
  renderWriteFailure,
  replacedFile,
  unchangedSince,
} from './write.js';
import { openWorkspace, readModelFile } from './workspace.js';

const target = (root: string, file: string) => ({
  file,
  path: join(root, file),
});

const failureOf = <Value>(
  outcome: Either.Either<Value, WriteFailure>,
): WriteFailure => {
  if (Either.isRight(outcome)) {
    throw new Error('the write succeeded, and this expects a refusal');
  }
  return outcome.left;
};

describe('replacing a file', () => {
  it('answers with the handle over the bytes it wrote', () => {
    const tree = editableTree();
    const written = replacedFile(
      target(tree.root, modelFile),
      'formatVersion: 1\n',
    );
    expect(Either.getOrUndefined(written)).toEqual(
      revisionOf(readFileSync(join(tree.root, modelFile))),
    );
  });

  it('keeps the permissions the file carried', () => {
    const tree = editableTree();
    chmodSync(join(tree.root, modelFile), 0o640);
    replacedFile(target(tree.root, modelFile), 'replaced\n');
    expect(statSync(join(tree.root, modelFile)).mode & 0o777).toEqual(0o640);
  });

  it('leaves no temporary file behind', () => {
    const tree = editableTree();
    const before = new Set(readdirSync(tree.root));
    replacedFile(target(tree.root, modelFile), 'replaced\n');
    expect(new Set(readdirSync(tree.root))).toEqual(before);
  });

  it('reports the reason the system gave where the directory is not there', () => {
    const tree = editableTree();
    const refused = replacedFile(
      target(tree.root, join('absent', 'model.yaml')),
      'replaced\n',
    );
    expect(renderWriteFailure(failureOf(refused)).join('\n')).toContain(
      'was not written: ENOENT',
    );
  });
});

describe('creating a file', () => {
  it('refuses a path already holding a file, leaving its bytes alone', () => {
    const tree = editableTree();
    const before = readFileSync(join(tree.root, modelFile));
    const refused = createdFile(target(tree.root, modelFile), 'replaced\n');
    expect(readFileSync(join(tree.root, modelFile))).toEqual(before);
    expect(renderWriteFailure(failureOf(refused))).toEqual([
      `The file "${modelFile}" is already there, and this tool writes only a path that is free.`,
    ]);
  });

  it('leaves no temporary file behind when it refuses', () => {
    const tree = editableTree();
    const before = new Set(readdirSync(tree.root));
    createdFile(target(tree.root, modelFile), 'replaced\n');
    expect(new Set(readdirSync(tree.root))).toEqual(before);
  });
});

describe('the handle a write quotes back', () => {
  it('goes on where the file still hashes to it', () => {
    const tree = editableTree();
    const workspace = Either.getOrThrow(openWorkspace({ root: tree.root }));
    const read = Either.getOrThrow(readModelFile(workspace, modelFile));
    expect(Either.isRight(unchangedSince(modelFile, read.revision, read))).toBe(
      true,
    );
  });

  it('names both handles where the file has moved on', () => {
    const tree = editableTree();
    const workspace = Either.getOrThrow(openWorkspace({ root: tree.root }));
    const read = Either.getOrThrow(readModelFile(workspace, modelFile));
    const stale = `sha256:${'0'.repeat(64)}`;
    expect(
      renderWriteFailure(failureOf(unchangedSince(modelFile, stale, read))),
    ).toEqual([
      `The file "${modelFile}" changed since the read this call quoted, so nothing was written.`,
      `The call quoted ${stale}, and the file on disk is ${read.revision}.`,
      'Read the file again and reconsider the edit against what it holds now.',
    ]);
  });
});

describe('the file a call names', () => {
  it('refuses a call naming none against a server carrying no default', () => {
    const tree = editableTree();
    const workspace = Either.getOrThrow(openWorkspace({ root: tree.root }));
    expect(
      renderWriteFailure(failureOf(namedFile(workspace, undefined)))[0],
    ).toContain('No file was named and this server carries no default');
  });
});
