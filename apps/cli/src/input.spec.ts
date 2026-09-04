import { DetectionFailure, ReadFailure } from '@panoptes/formats';
import { Either } from 'effect';
import { join } from 'node:path';
import {
  describeDivergences,
  describeReadFailure,
  readModel,
} from './input.js';

const repositoryRoot = join(import.meta.dirname, '../../..');

describe('a model file read at the edge', () => {
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
});

describe('why a read produced nothing', () => {
  it('names the bound a text was past', () => {
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

  it("carries the parser's own message for a text of no syntax", () => {
    expect(
      describeReadFailure(ReadFailure.MalformedText({ message: 'bad token' })),
    ).toEqual(
      'The file is not valid text of the format that claimed it.\nbad token\n',
    );
  });

  it('points into the document the wire schema refused', () => {
    expect(
      describeReadFailure(
        ReadFailure.InvalidWireDocument({
          issues: [
            {
              path: ['metadata', 'title'],
              message: 'expected string',
              code: 'invalid_type',
            },
          ],
        }),
      ),
    ).toEqual(
      'The file is not a valid document of the format that claimed it:\n' +
        'metadata.title: expected string\n',
    );
  });

  it('names the whole document where an issue points at no path', () => {
    expect(
      describeReadFailure(
        ReadFailure.InvalidModel({
          issues: [
            { path: [], message: 'expected object', code: 'invalid_type' },
          ],
        }),
      ),
    ).toEqual(
      'The file is a valid document, and the model it maps to is not:\n' +
        '(root): expected object\n',
    );
  });

  it('lists the formats tried where none claimed the text', () => {
    expect(
      describeReadFailure(
        DetectionFailure.NoFormatClaimed({
          tried: ['threat-dragon', 'panoptes-yaml'],
        }),
      ),
    ).toEqual(
      'No format claimed the file. Panoptes tried threat-dragon, panoptes-yaml.\n' +
        'A formatVersion other than 1, and a Threat Dragon version outside major 2, land here: a later release of either format needs a codec of its own rather than a looser reader.\n',
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
