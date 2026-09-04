import type { DetectedRead } from '@panoptes/formats';
import { Either } from 'effect';
import { describeDivergences, readModel } from './input.js';
import { lines, succeeded, type CommandOutcome } from './outcome.js';

/**
 * `panoptes validate <file>`: the file read as whichever format claims its
 * content, reported as one line naming that format and what the model
 * holds. The file name is never consulted, so a Panoptes model saved as
 * `.json` reads as well as one saved as `.yaml`.
 */
export function validate(file: string): CommandOutcome {
  return Either.match(readModel(file), {
    onLeft: (outcome) => outcome,
    onRight: (read) =>
      succeeded(lines(summaryOf(read)), describeDivergences(read.divergences)),
  });
}

function summaryOf(read: DetectedRead): string {
  const elements = read.model.diagrams.reduce(
    (total, diagram) => total + diagram.elements.length,
    0,
  );
  const counts = [
    counted(read.model.diagrams.length, 'diagram'),
    counted(elements, 'element'),
    counted(read.model.threats.length, 'threat'),
  ];
  return `${read.format}: ${counts.join(', ')}`;
}

function counted(total: number, noun: string): string {
  return `${String(total)} ${noun}${total === 1 ? '' : 's'}`;
}
