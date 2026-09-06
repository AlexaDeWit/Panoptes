import type { DiagramId, Model } from '@panoptes/model';
import { nameOf } from '../files/session.js';
import { FileLifecycle, placeholderModel, type State } from './state.js';

const productName = 'Panoptes';

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
 * The model as it arrived, which is a file just opened or the placeholder the
 * studio starts on, and nothing at all once anything has been edited, undone
 * or redone. The canvas fits the viewport to it and reads it by identity, so
 * opening a file again fits the diagram again, while a save, which leaves the
 * model where it is, moves nothing.
 */
export function modelAsOpened(state: State): Model | undefined {
  return state.past.length === 0 && state.future.length === 0
    ? state.present
    : undefined;
}

/**
 * Whether the studio is still on the model it opens with and nothing has
 * happened to it: no edit, no undo, no redo, and no file. Both halves are
 * needed, because a save leaves the model where it is and only the file
 * moves. It is what the canvas hangs its hint on, so the hint goes at the
 * first edit and comes back when the model is closed back to this one.
 */
export function showingPlaceholder(state: State): boolean {
  return (
    modelAsOpened(state) === placeholderModel &&
    FileLifecycle.$is('NoFile')(state.file)
  );
}

/**
 * What the browser tab is named: the model's name as {@link nameOf} gives it,
 * the file it lives in or "Untitled" while it lives in none, ahead of the
 * product name, since a narrow tab shows the head of a title. Reading the
 * name through the same function as the menu is what keeps the two from
 * disagreeing.
 */
export function windowTitle(state: State): string {
  return `${nameOf(state.file)} - ${productName}`;
}
