import { ReadFailure, readLimits } from '@saerskriven/formats';
import { Either } from 'effect';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ansiElementIdYaml,
  fixtureFile,
  literalEscapeIdYaml,
} from './cli.fixtures.js';
import * as files from './files.js';
import {
  describeDivergences,
  describeReadFailure,
  readModel,
} from './input.js';

const repositoryRoot = join(import.meta.dirname, '../../..');

const directory = mkdtempSync(join(tmpdir(), 'saerskriven-cli-input-'));

const refusedModel = (err: string) => Either.left({ code: 1, out: '', err });

describe('a model file read at the edge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gives the read back where a codec claimed the file', () => {
    const read = readModel(join(repositoryRoot, 'test-data/ecluse.json'));
    expect(Either.isRight(read)).toBe(true);
  });

  it('answers a file the process cannot read with a usage outcome', () => {
    const path = join(repositoryRoot, 'test-data/absent.json');
    expect(readModel(path)).toEqual(
      Either.left({
        code: 2,
        out: '',
        err: `error: cannot read ${path}: ENOENT: no such file or directory, open '${path}'\n`,
      }),
    );
  });

  it('refuses a file past the size bound without reading it', () => {
    const path = join(directory, 'huge.yaml');
    const size = readLimits.maxTextBytes + 1;
    writeFileSync(path, 'x'.repeat(size));
    const read = vi.spyOn(files, 'readTextFile');
    expect(readModel(path)).toEqual(
      refusedModel(
        'The file is past a read bound, so nothing read it.\n' +
          `maxTextBytes: the bound is ${String(readLimits.maxTextBytes)}, the file reached ${String(size)}.\n`,
      ),
    );
    expect(read).not.toHaveBeenCalled();
  });

  it('escapes the control characters a model file put in an issue', () => {
    const path = fixtureFile(directory, 'ansi-id.yaml', ansiElementIdYaml);
    expect(readModel(path)).toEqual(
      refusedModel(
        'The file is a valid document, and the model it maps to is not:\n' +
          'threats.0.elements.0: Text carries a character the model does not accept.\n' +
          'threats.0.elements.0: Threat elements references unknown element id "\\u001b[31mBOOM\\u001b[0m".\n',
      ),
    );
  });

  it('tells a text spelling an escape apart from one carrying it', () => {
    const path = fixtureFile(directory, 'literal.yaml', literalEscapeIdYaml);
    expect(readModel(path)).toEqual(
      refusedModel(
        'The file is a valid document, and the model it maps to is not:\n' +
          'threats.0.elements.0: Threat elements references unknown element id "\\\\e[31mBOOM\\\\e[0m".\n',
      ),
    );
  });
});

describe('why a read produced nothing', () => {
  it('writes the wording the codec layer owns as one line each', () => {
    expect(
      describeReadFailure(
        ReadFailure.ExceededReadLimit({
          limit: 'maxNestingDepth',
          bound: 64,
          observed: 65,
        }),
      ),
    ).toEqual(
      'The file is past a read bound, so nothing read it.\n' +
        'maxNestingDepth: the bound is 64, the file reached 65.\n',
    );
  });
});

describe('what a read cost', () => {
  it('says nothing where the file and the model correspond', () => {
    expect(describeDivergences([])).toEqual('');
  });

  it('warns with the rendering the codec owns where they do not', () => {
    expect(
      describeDivergences([
        {
          subject: { kind: 'model' },
          detail: 'the key nonsense',
          reason: 'undeclared',
        },
      ]),
    ).toEqual(
      'warning: the file and the model do not correspond exactly.\n' +
        'model: the key nonsense (not declared by the wire schema)\n',
    );
  });
});
