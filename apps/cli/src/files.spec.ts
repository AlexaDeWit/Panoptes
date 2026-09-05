import { Either } from 'effect';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readTextFile, reasonOf, writeFile } from './files.js';

const directory = mkdtempSync(join(tmpdir(), 'panoptes-cli-files-'));

describe('text files at the edge', () => {
  it('writes a text and reads back what it wrote', () => {
    const path = join(directory, 'written.txt');
    expect(writeFile(path, 'Écluse\n')).toEqual(Either.right(undefined));
    expect(readTextFile(path)).toEqual(Either.right('Écluse\n'));
  });

  it('names the path and the reason where a file is not there', () => {
    const path = join(directory, 'absent.txt');
    expect(readTextFile(path)).toEqual(
      Either.left(
        `cannot read ${path}: ENOENT: no such file or directory, open '${path}'`,
      ),
    );
  });

  it('names the path and the reason where a file cannot be written', () => {
    const path = join(directory, 'absent', 'written.txt');
    expect(writeFile(path, '')).toEqual(
      Either.left(
        `cannot write ${path}: ENOENT: no such file or directory, open '${path}'`,
      ),
    );
    expect(existsSync(path)).toBe(false);
  });

  it('reports a thrown value that is not an Error as it prints', () => {
    expect(reasonOf('the disk went away')).toEqual('the disk went away');
  });
});
