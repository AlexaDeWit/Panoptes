import type { DiagramId, Threat } from '@panoptes/model';
import type { State } from './state.js';

/**
 * The model on screen is not the model the file holds. It is identity, not a
 * comparison: every operation returns a new model, so undoing back to the
 * saved point restores the very object `saved` holds and the studio is clean
 * again with nothing to reset.
 */
export function isDirty(state: State): boolean {
  return state.present !== state.saved;
}

/** There is a model to go back to. */
export function canUndo(state: State): boolean {
  return state.past.length > 0;
}

/** There is a model to go forward to. */
export function canRedo(state: State): boolean {
  return state.future.length > 0;
}

/** How many elements the model holds, across all of its diagrams. */
export function elementCount(state: State): number {
  return state.present.diagrams.reduce(
    (total, diagram) => total + diagram.elements.length,
    0,
  );
}

/**
 * The diagram an edit lands on, which is the first the model holds until the
 * studio can show more than one, and nothing at all while the model has
 * none.
 */
export function firstDiagramId(state: State): DiagramId | undefined {
  return state.present.diagrams.at(0)?.id;
}

/**
 * The threat the panel edits, which is the first the model holds until a
 * selection decides one (#40), and nothing at all while the register is
 * empty. The model's operations share what they did not change, so this
 * returns the same object until the threat itself moves.
 */
export function editedThreat(state: State): Threat | undefined {
  return state.present.threats.at(0);
}
