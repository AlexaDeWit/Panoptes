import { readLimits } from '@saerskriven/formats';
import { Either } from 'effect';
import {
  chmodSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { editableTree, modelFile } from './edit.fixtures.js';
import { revisionOf } from './revision.js';
import {
  WriteFailure,
  createdFile,
  namedFile,
  renderWriteFailure,
  replacedFile,
  serialized,
  unchangedSince,
} from './write.js';
import { openWorkspace, readModelFile } from './workspace.js';

const target = (root: string, file: string) => ({
  file,
  path: join(root, file),
});

const revisionIn = (root: string, file: string): string =>
  revisionOf(readFileSync(join(root, file)));

const staleRevision = `sha256:${'0'.repeat(64)}`;

const paddedTo = (root: string, bytes: number): string => {
  const model = readFileSync(join(root, modelFile), 'utf8');
  return `${model}#${'a'.repeat(bytes - Buffer.byteLength(model) - 2)}\n`;
};

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
      revisionIn(tree.root, modelFile),
    );
    expect(Either.getOrUndefined(written)).toEqual(
      revisionIn(tree.root, modelFile),
    );
  });

  it('keeps the permissions the file carried', () => {
    const tree = editableTree();
    chmodSync(join(tree.root, modelFile), 0o640);
    replacedFile(
      target(tree.root, modelFile),
      'replaced\n',
      revisionIn(tree.root, modelFile),
    );
    expect(statSync(join(tree.root, modelFile)).mode & 0o777).toEqual(0o640);
  });

  it('prefers the mode the target carries to the one for a new file', () => {
    const tree = editableTree();
    const path = join(tree.root, modelFile);
    chmodSync(path, 0o640);
    replacedFile(
      target(tree.root, modelFile),
      'replaced\n',
      revisionOf(readFileSync(path)),
      0o600,
    );
    expect(statSync(path).mode & 0o777).toEqual(0o640);
  });

  it('leaves no temporary file behind', () => {
    const tree = editableTree();
    const before = new Set(readdirSync(tree.root));
    replacedFile(
      target(tree.root, modelFile),
      'replaced\n',
      revisionIn(tree.root, modelFile),
    );
    expect(new Set(readdirSync(tree.root))).toEqual(before);
  });

  it('reports the reason the system gave where the directory is not there', () => {
    const tree = editableTree();
    const refused = replacedFile(
      target(tree.root, join('absent', 'model.yaml')),
      'replaced\n',
      staleRevision,
    );
    expect(renderWriteFailure(failureOf(refused)).join('\n')).toContain(
      'was not written: ENOENT',
    );
  });
});

describe('a save that lands while a replacement is being prepared', () => {
  it('is refused by the hash taken before the rename, leaving the file alone', () => {
    const tree = editableTree();
    const quoted = revisionIn(tree.root, modelFile);
    writeFileSync(join(tree.root, modelFile), 'the other writer saved\n');
    const before = new Set(readdirSync(tree.root));
    const refused = replacedFile(
      target(tree.root, modelFile),
      'formatVersion: 1\n',
      quoted,
    );
    expect(readFileSync(join(tree.root, modelFile)).toString('utf8')).toEqual(
      'the other writer saved\n',
    );
    expect(new Set(readdirSync(tree.root))).toEqual(before);
    expect(renderWriteFailure(failureOf(refused))).toEqual([
      `The file "${modelFile}" changed since the read this call quoted, so nothing was written.`,
      `The call quoted ${quoted}, and the file on disk is ${revisionIn(tree.root, modelFile)}.`,
      'Read the file again and reconsider the edit against what it holds now.',
    ]);
  });

  it('reports the reason the system gave where the target is gone', () => {
    const tree = editableTree();
    const before = new Set(readdirSync(tree.root));
    const refused = replacedFile(
      target(tree.root, 'removed.yaml'),
      'replaced\n',
      staleRevision,
    );
    expect(new Set(readdirSync(tree.root))).toEqual(before);
    expect(renderWriteFailure(failureOf(refused)).join('\n')).toContain(
      'was not written: ENOENT',
    );
  });

  it('refuses a target grown past the bound this server reads', () => {
    const tree = editableTree();
    const quoted = revisionIn(tree.root, modelFile);
    const grown = Buffer.alloc(readLimits.maxTextBytes + 1, 0x61);
    writeFileSync(join(tree.root, modelFile), grown);
    const refused = replacedFile(
      target(tree.root, modelFile),
      'formatVersion: 1\n',
      quoted,
    );
    expect(statSync(join(tree.root, modelFile)).size).toEqual(grown.length);
    expect(renderWriteFailure(failureOf(refused))).toEqual([
      `The file "${modelFile}" was not written: it is now ${String(grown.length)} bytes, past the ${String(readLimits.maxTextBytes)} this server reads.`,
    ]);
  });
});

describe('a write past the size this server reads', () => {
  it('is written at exactly the bound, and the read accepts what it wrote', () => {
    const tree = editableTree();
    const text = paddedTo(tree.root, readLimits.maxTextBytes);
    const written = replacedFile(
      target(tree.root, modelFile),
      text,
      revisionIn(tree.root, modelFile),
    );
    const workspace = Either.getOrThrow(openWorkspace({ root: tree.root }));
    expect(Either.isRight(written)).toBe(true);
    expect(statSync(join(tree.root, modelFile)).size).toEqual(
      readLimits.maxTextBytes,
    );
    expect(Either.isRight(readModelFile(workspace, modelFile))).toBe(true);
  });

  it('matches the read, which refuses a file one byte past it', () => {
    const tree = editableTree();
    const size = readLimits.maxTextBytes + 1;
    writeFileSync(join(tree.root, modelFile), paddedTo(tree.root, size));
    const workspace = Either.getOrThrow(openWorkspace({ root: tree.root }));
    expect(readModelFile(workspace, modelFile)).toMatchObject({
      left: {
        _tag: 'Unread',
        failure: { _tag: 'ExceededReadLimit', observed: size },
      },
    });
  });

  it('is refused one byte past it, leaving the file byte-identical', () => {
    const tree = editableTree();
    const before = readFileSync(join(tree.root, modelFile));
    const entries = new Set(readdirSync(tree.root));
    const size = readLimits.maxTextBytes + 1;
    const refused = replacedFile(
      target(tree.root, modelFile),
      paddedTo(tree.root, size),
      revisionIn(tree.root, modelFile),
    );
    expect(readFileSync(join(tree.root, modelFile))).toEqual(before);
    expect(new Set(readdirSync(tree.root))).toEqual(entries);
    expect(failureOf(refused)).toEqual(
      WriteFailure.PastReadBound({ file: modelFile, size }),
    );
  });

  it('counts UTF-8 bytes rather than code units', () => {
    const tree = editableTree();
    const text = `# ${'é'.repeat(readLimits.maxTextBytes / 2)}\n`;
    const refused = createdFile(target(tree.root, 'fresh.yaml'), text);
    expect(text.length).toBeLessThan(readLimits.maxTextBytes);
    expect(failureOf(refused)).toEqual(
      WriteFailure.PastReadBound({
        file: 'fresh.yaml',
        size: Buffer.byteLength(text),
      }),
    );
  });

  it('is refused where it creates a file, leaving the path free', () => {
    const tree = editableTree();
    const size = readLimits.maxTextBytes + 1;
    const refused = createdFile(
      target(tree.root, 'fresh.yaml'),
      paddedTo(tree.root, size),
    );
    expect(readdirSync(tree.root)).not.toContain('fresh.yaml');
    expect(renderWriteFailure(failureOf(refused)).join('\n')).toContain(
      'past the size this server reads',
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

  it('gives the file it creates the mode it was handed', () => {
    const tree = editableTree();
    const created = createdFile(
      target(tree.root, 'fresh.yaml'),
      'formatVersion: 1\n',
      0o600,
    );
    expect(Either.isRight(created)).toEqual(true);
    expect(statSync(join(tree.root, 'fresh.yaml')).mode & 0o777).toEqual(0o600);
  });

  it('leaves a file it creates to the umask where it is handed no mode', () => {
    const tree = editableTree();
    createdFile(target(tree.root, 'plain.yaml'), 'formatVersion: 1\n');
    expect(statSync(join(tree.root, 'plain.yaml')).mode & 0o200).toEqual(0o200);
  });

  it('leaves no temporary file behind when it refuses', () => {
    const tree = editableTree();
    const before = new Set(readdirSync(tree.root));
    createdFile(target(tree.root, modelFile), 'replaced\n');
    expect(new Set(readdirSync(tree.root))).toEqual(before);
  });
});

describe('a codec that throws', () => {
  it('is contained as a refusal rather than left to reach the transport', () => {
    const refused = serialized('model.yaml', () => {
      throw new Error('the codec gave up');
    });
    expect(renderWriteFailure(failureOf(refused))).toEqual([
      'The file "model.yaml" was not written: the codec gave up.',
    ]);
  });

  it('answers with what the codec produced where it produced one', () => {
    const written = serialized('model.yaml', () => ({
      output: 'formatVersion: 1\n',
      divergences: [],
    }));
    expect(Either.getOrUndefined(written)?.output).toEqual(
      'formatVersion: 1\n',
    );
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
    expect(
      renderWriteFailure(
        failureOf(unchangedSince(modelFile, staleRevision, read)),
      ),
    ).toEqual([
      `The file "${modelFile}" changed since the read this call quoted, so nothing was written.`,
      `The call quoted ${staleRevision}, and the file on disk is ${read.revision}.`,
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
