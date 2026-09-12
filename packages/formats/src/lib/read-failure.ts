import type { ParseIssue } from '@saerskriven/model';
import { ReadFailure } from './codec.js';
import { DetectionFailure } from './detect.js';
import { escapedForTerminal } from './divergence.js';

/**
 * Why a read produced nothing, as the lines a reader takes in order. No line
 * carries a terminator, so a caller joins them the way its own output wants.
 * Every variant is worded, `MalformedText` included, which detection reads as
 * the codec declining rather than passing on, so a caller holding the union
 * has nothing left to narrow and no failure reaches a reader as a tag.
 *
 * A path and a message come out of a file, so both are escaped the way
 * {@link escapedForTerminal} escapes a text: one entry cannot become two
 * lines, and an escape a file carries cannot move a terminal's cursor.
 */
export function renderReadFailure(
  failure: ReadFailure | DetectionFailure,
): readonly string[] {
  return DetectionFailure.$is('NoFormatClaimed')(failure)
    ? [
        `No format claimed the file. Saerskriven tried ${failure.tried.join(', ')}.`,
      ]
    : ReadFailure.$match(failure, {
        ExceededReadLimit: ({ limit, bound, observed }) => [
          'The file is past a read bound, so nothing read it.',
          `${limit}: the bound is ${String(bound)}, the file reached ${String(observed)}.`,
        ],
        MalformedText: ({ message }) => [
          'The file is not valid text of the format that claimed it.',
          message,
        ],
        InvalidWireDocument: ({ issues }) => [
          'The file is not a valid document of the format that claimed it:',
          ...issueLines(issues),
        ],
        InvalidModel: ({ issues }) => [
          'The file is a valid document, and the model it maps to is not:',
          ...issueLines(issues),
        ],
      });
}

function issueLines(issues: readonly ParseIssue[]): readonly string[] {
  return issues.map((issue) =>
    escapedForTerminal(`${pathOf(issue.path)}: ${issue.message}`),
  );
}

function pathOf(path: readonly (string | number)[]): string {
  return path.length > 0 ? path.join('.') : '(root)';
}
