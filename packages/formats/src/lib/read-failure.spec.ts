import { ReadFailure } from './codec.js';
import { DetectionFailure } from './detect.js';
import { renderReadFailure } from './read-failure.js';

describe('why a read produced nothing', () => {
  it('names the bound a text was past', () => {
    expect(
      renderReadFailure(
        ReadFailure.ExceededReadLimit({
          limit: 'maxNestingDepth',
          bound: 64,
          observed: 65,
        }),
      ),
    ).toEqual([
      'The file is past a read bound, so nothing read it.',
      'maxNestingDepth: the bound is 64, the file reached 65.',
    ]);
  });

  it("carries the parser's own message for a text of no syntax", () => {
    expect(
      renderReadFailure(ReadFailure.MalformedText({ message: 'bad token' })),
    ).toEqual([
      'The file is not valid text of the format that claimed it.',
      'bad token',
    ]);
  });

  it('points into the document the wire schema refused', () => {
    expect(
      renderReadFailure(
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
    ).toEqual([
      'The file is not a valid document of the format that claimed it:',
      'metadata.title: expected string',
    ]);
  });

  it('names the whole document where an issue points at no path', () => {
    expect(
      renderReadFailure(
        ReadFailure.InvalidModel({
          issues: [
            { path: [], message: 'expected object', code: 'invalid_type' },
          ],
        }),
      ),
    ).toEqual([
      'The file is a valid document, and the model it maps to is not:',
      '(root): expected object',
    ]);
  });

  it('escapes an escape the refused document carried into a message', () => {
    expect(
      renderReadFailure(
        ReadFailure.InvalidModel({
          issues: [
            {
              path: ['threats', 0],
              message: 'saw \u001b[31m',
              code: 'custom',
            },
          ],
        }),
      ),
    ).toEqual([
      'The file is a valid document, and the model it maps to is not:',
      'threats.0: saw \\u001b[31m',
    ]);
  });

  it('lists the formats tried where none claimed the text', () => {
    expect(
      renderReadFailure(
        DetectionFailure.NoFormatClaimed({
          tried: ['threat-dragon', 'saerskriven-yaml'],
        }),
      ),
    ).toEqual([
      'No format claimed the file. Saerskriven tried threat-dragon, saerskriven-yaml.',
    ]);
  });
});
