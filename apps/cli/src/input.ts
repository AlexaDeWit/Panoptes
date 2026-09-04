import {
  DetectionFailure,
  ReadFailure,
  hasDiverged,
  readAnyFormat,
  renderDivergences,
  type DetectedRead,
  type Divergence,
} from '@panoptes/formats';
import type { ParseIssue } from '@panoptes/model';
import { Either } from 'effect';
import { readTextFile } from './files.js';
import {
  invalidInput,
  lines,
  usageError,
  type CommandOutcome,
} from './outcome.js';

const laterRelease =
  'A formatVersion other than 1, and a Threat Dragon version outside major ' +
  '2, land here: a later release of either format needs a codec of its own ' +
  'rather than a looser reader.';

/**
 * The file read as whichever format claims its content, or the outcome the
 * edge reports instead. A path the process cannot read is the invocation's
 * fault and exits 2. A text no codec claims, or one a codec read and
 * refused, is the input's and exits 1. Both commands start here, so the two
 * of them cannot word the same failure differently.
 */
export function readModel(
  file: string,
): Either.Either<DetectedRead, CommandOutcome> {
  return Either.match(readTextFile(file), {
    onLeft: (reason) => Either.left(usageError(lines(`error: ${reason}`))),
    onRight: (text) =>
      Either.mapLeft(readAnyFormat(text), (failure) =>
        invalidInput(describeReadFailure(failure)),
      ),
  });
}

/**
 * Why a read produced nothing, as the lines a person reads on standard
 * error. Every variant is worded, `MalformedText` included, which detection
 * reads as the codec declining rather than passing on, so a caller holding
 * the union has nothing left to narrow and no failure reaches a user as a
 * tag.
 */
export function describeReadFailure(
  failure: ReadFailure | DetectionFailure,
): string {
  return DetectionFailure.$is('NoFormatClaimed')(failure)
    ? lines(
        `No format claimed the file. Panoptes tried ${failure.tried.join(', ')}.`,
        laterRelease,
      )
    : ReadFailure.$match(failure, {
        ExceededReadLimit: ({ limit, bound, observed }) =>
          lines(
            'The file is past a read bound, so nothing read it.',
            `${limit}: the bound is ${String(bound)}, the file reached ${String(observed)}.`,
          ),
        MalformedText: ({ message }) =>
          lines(
            'The file is not valid text of the format that claimed it.',
            message,
          ),
        InvalidWireDocument: ({ issues }) =>
          lines(
            'The file is not a valid document of the format that claimed it:',
            ...issueLines(issues),
          ),
        InvalidModel: ({ issues }) =>
          lines(
            'The file is a valid document, and the model it maps to is not:',
            ...issueLines(issues),
          ),
      });
}

/**
 * The divergences a read recorded, as a warning, and nothing at all where
 * the file and the model correspond exactly. A divergence is not a failure:
 * the file was read, and this says what the reading cost.
 */
export function describeDivergences(
  divergences: readonly Divergence[],
): string {
  return hasDiverged(divergences)
    ? lines(
        'warning: the file and the model do not correspond exactly.',
        renderDivergences(divergences),
      )
    : '';
}

function issueLines(issues: readonly ParseIssue[]): readonly string[] {
  return issues.map((issue) => `${pathOf(issue.path)}: ${issue.message}`);
}

function pathOf(path: readonly (string | number)[]): string {
  return path.length > 0 ? path.join('.') : '(root)';
}
