import type { DiagramId, Element, ElementId, Model } from '@saerskriven/model';
import { nameOf } from '../files/session.js';
import { FileLifecycle, placeholderModel, type State } from './state.js';

const productName = 'Saerskriven';

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
 * The element `elementId` names, in whichever diagram the model draws it,
 * and nothing at all where the model holds none by that id.
 */
export function elementById(
  state: State,
  elementId: ElementId,
): Element | undefined {
  return state.present.diagrams
    .flatMap((diagram) => diagram.elements)
    .find((element) => element.id === elementId);
}

/** The selected element ID where exactly one is selected. */
export function selectedElement(state: State): ElementId | undefined {
  return state.selection.length === 1 ? state.selection.at(0) : undefined;
}

/** The selected element IDs, in selection order. */
export function selectedElements(state: State): readonly ElementId[] {
  return state.selection;
}

/**
 * Whether the element `elementId` names has a name a field can open. A text
 * note has not: what it draws is its prose rather than its name, so a field
 * over one would edit nothing a person can see.
 */
export function nameEditable(state: State, elementId: ElementId): boolean {
  const element = elementById(state, elementId);
  return element !== undefined && element.kind !== 'text';
}

/**
 * Whether the rename command has something to open a field on, which is what
 * the control offering it reads so it is not live over a selection it would
 * do nothing to.
 */
export function renameable(state: State): boolean {
  const selected = selectedElement(state);
  return selected !== undefined && nameEditable(state, selected);
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
