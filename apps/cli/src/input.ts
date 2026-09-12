import {
  ReadFailure,
  hasDiverged,
  readAnyFormat,
  readLimits,
  renderDivergences,
  renderReadFailure,
  type DetectedRead,
  type DetectionFailure,
  type Divergence,
} from '@saerskriven/formats';
import { Either } from 'effect';
import { readTextFile, sizeOf } from './files.js';
import {
  invalidInput,
  lines,
  usageError,
  type CommandOutcome,
} from './outcome.js';

/**
 * The file read as whichever format claims its content, or the outcome the
 * edge reports instead. A path the process cannot read is the invocation's
 * fault and exits 2. A text no codec claims, one past a read bound, or one
 * a codec read and refused, is the input's and exits 1. Both commands start
 * here, so the two of them cannot word the same failure differently.
 */
export function readModel(
  file: string,
): Either.Either<DetectedRead, CommandOutcome> {
  return Either.flatMap(withinSizeBound(file), () => detected(file));
}

/** Why a read produced nothing, as the lines the CLI writes to standard error. */
export function describeReadFailure(
  failure: ReadFailure | DetectionFailure,
): string {
  return lines(...renderReadFailure(failure));
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

function withinSizeBound(file: string): Either.Either<void, CommandOutcome> {
  const size = sizeOf(file);
  return size === undefined || size <= readLimits.maxTextBytes
    ? Either.right(undefined)
    : Either.left(
        invalidInput(
          describeReadFailure(
            ReadFailure.ExceededReadLimit({
              limit: 'maxTextBytes',
              bound: readLimits.maxTextBytes,
              observed: size,
            }),
          ),
        ),
      );
}

function detected(file: string): Either.Either<DetectedRead, CommandOutcome> {
  return Either.match(readTextFile(file), {
    onLeft: (reason) => Either.left(usageError(lines(`error: ${reason}`))),
    onRight: (text) =>
      Either.mapLeft(readAnyFormat(text), (failure) =>
        invalidInput(describeReadFailure(failure)),
      ),
  });
}
