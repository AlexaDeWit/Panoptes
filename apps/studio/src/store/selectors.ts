import type {
  Diagram,
  DiagramId,
  Element,
  ElementId,
  Model,
} from '@saerskriven/model';
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

/** The dirty session lacks a confirmed recovery write. */
export function needsCloseGuard(state: State): boolean {
  return isDirty(state) && !state.recoveryCurrent;
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
 * The diagram on screen, which every canvas edit lands on: the one
 * `activeDiagram` names while the model holds it, the first the model holds
 * otherwise, and nothing at all while the model has none. Falling back
 * rather than refusing is what keeps an undo that takes the named diagram
 * away from leaving the canvas on nothing.
 */
export function activeDiagram(
  state: Pick<State, 'present' | 'activeDiagram'>,
): Diagram | undefined {
  return (
    state.present.diagrams.find(
      (diagram) => diagram.id === state.activeDiagram,
    ) ?? state.present.diagrams.at(0)
  );
}

/** Whether `model` holds a diagram of id `diagramId`. */
export function holdsDiagram(
  model: Model,
  diagramId: DiagramId | undefined,
): boolean {
  return (
    diagramId !== undefined &&
    model.diagrams.some((diagram) => diagram.id === diagramId)
  );
}

/** The id of {@link activeDiagram}. */
export function activeDiagramId(
  state: Pick<State, 'present' | 'activeDiagram'>,
): DiagramId | undefined {
  return activeDiagram(state)?.id;
}

/** Whether the model holds a diagram to switch to. */
export function severalDiagrams(state: State): boolean {
  return state.present.diagrams.length > 1;
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
 * happened to it. The document title uses this state for its landing title.
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
