import type { ElementId, Model } from '@panoptes/model';
import { Action } from '../store/actions.js';
import {
  elementById,
  firstDiagramId,
  nameEditable,
  renameable,
} from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { announce } from './announcements.js';
import {
  flowEnds,
  freePosition,
  freshElement,
  freshFlow,
  type PaletteKind,
} from './elements.js';
import { currentLayout } from './layout.js';
import { accessibleNames } from './names.js';

/**
 * What a removal takes with the element, counted before it happens. The model
 * keeps a flow whose end was attached and frees that end, and keeps a threat
 * whose link named the element and drops the link, so both are changes a
 * person watching the canvas has to be told about rather than losses.
 */
export type RemovalCascade = {
  readonly flows: number;
  readonly threats: number;
};

/**
 * Adds one element of `kind` to the diagram on screen, selects it, says so,
 * and moves focus to it. The add is one action and so one step of the undo
 * stack; the selection that follows is not, the store keeping selection out
 * of its history.
 */
export function addPaletteElement(kind: PaletteKind): void {
  const state = modelStore.getState();
  const diagramId = firstDiagramId(state);
  if (diagramId === undefined) {
    return;
  }
  const element = freshElement(kind, freePosition(currentLayout(state)));
  added(Action.AddElement({ diagramId, element }), element.id);
}

/**
 * Draws a flow from one element to another, on the same terms as
 * {@link addPaletteElement}: one action, then the selection and the focus.
 * Both ways of connecting land here, so a drag between handles and a choice
 * from the palette's listbox add the same flow, and both are refused an end
 * that is not one of {@link flowEnds}. The refusal is here rather than in
 * either control because the model takes an endpoint naming any element of
 * the diagram, a flow included, and the layout then drops the flow it cannot
 * place: an unplaceable flow would sit in the model and in the next saved
 * file while being drawn nowhere.
 */
export function connectElements(source: ElementId, target: ElementId): void {
  const state = modelStore.getState();
  const diagramId = firstDiagramId(state);
  const ends = new Set(flowEnds(currentLayout(state)).map((node) => node.id));
  if (diagramId === undefined || !ends.has(source) || !ends.has(target)) {
    return;
  }
  const flow = freshFlow(source, target);
  added(Action.AddElement({ diagramId, element: flow }), flow.id);
}

/**
 * Removes the selected element, saying what went with it. Reports whether the
 * model moved, so the caller knows whether a key press did anything and where
 * focus has to go next. The cascade is the model's own: the reducer applies
 * it, the canvas draws the result because it derives from the store, and this
 * counts it beforehand only to be able to say it.
 */
export function removeSelected(): boolean {
  const state = modelStore.getState();
  const elementId = state.selection;
  if (elementId === undefined) {
    return false;
  }
  const name = spokenName(state, elementId);
  const cascade = removalCascade(state.present, elementId);
  if (!changedModel(Action.RemoveElement({ elementId }))) {
    return false;
  }
  announce(describeRemoval(name, cascade));
  return true;
}

/**
 * How many flows lose an end and how many threats lose a link when the
 * element named is removed. Flows are counted across the model because a
 * flow's ends name elements of its own diagram, so no flow elsewhere can
 * hold this one.
 */
export function removalCascade(
  model: Model,
  elementId: ElementId,
): RemovalCascade {
  const flows = model.diagrams
    .flatMap((diagram) => diagram.elements)
    .filter(
      (element) =>
        element.kind === 'flow' &&
        [element.source, element.target].some(
          (endpoint) =>
            endpoint.kind === 'attached' && endpoint.element === elementId,
        ),
    ).length;
  const threats = model.threats.filter((threat) =>
    threat.elements.includes(elementId),
  ).length;
  return { flows, threats };
}

/**
 * A removal in words: what went, and what the model changed around it. The
 * counts are always said, a zero among them included, so silence never has
 * to be read as either nothing happening or nothing being counted.
 */
export function describeRemoval(name: string, cascade: RemovalCascade): string {
  const flows = counted(cascade.flows, 'flow');
  const threats = counted(cascade.threats, 'threat link');
  return `Removed ${name}. ${flows} detached, ${threats} dropped.`;
}

/**
 * Opens the selected element's name in a field on the canvas, and does
 * nothing while nothing is selected. It is what the rename command runs, so
 * the key and the double-click reach one place. Which element is being
 * renamed is store state rather than the canvas's own, because the command
 * is pressed with nothing of the canvas mounted above it ([the
 * store](../store/README.md)).
 */
export function renameSelected(): void {
  const state = modelStore.getState();
  const elementId = state.selection;
  if (elementId !== undefined && renameable(state)) {
    dispatch(Action.Renaming({ elementId }));
  }
}

/**
 * Opens `elementId`'s name in a field, which is what a double-click does. It
 * reads the same rule the control offering the command reads, so a gesture
 * and a menu item agree about what has a name to edit.
 */
export function beginRenaming(elementId: ElementId): void {
  if (nameEditable(modelStore.getState(), elementId)) {
    dispatch(Action.Renaming({ elementId }));
  }
}

/**
 * Closes the open field and puts focus back on the element it was drawn
 * over. It is what a key press settles on, Enter and Escape alike, where the
 * person left focus in the field and would otherwise be dropped onto the
 * page.
 */
export function endRenaming(elementId: ElementId): void {
  dispatch(Action.Renaming({ elementId: undefined }));
  focusElement(elementId);
}

/**
 * Closes the open field and leaves focus where it is. It is what a field
 * settles on when it is left, the person having already put focus on
 * something else: sending it back would undo the click that landed there.
 */
export function stopRenaming(): void {
  dispatch(Action.Renaming({ elementId: undefined }));
}

/**
 * Renames `elementId`, as one action and so one undo step. A name the model
 * already holds dispatches nothing: a model operation returns a new model
 * whatever it was asked to do, so the store would push an undo entry and
 * mark the file dirty over an edit nobody made, which is the rule the panel
 * commits its fields under ([the panel](../panel/README.md)).
 */
export function commitRename(elementId: ElementId, name: string): void {
  const element = elementById(modelStore.getState(), elementId);
  if (element === undefined || element.name === name) {
    return;
  }
  dispatch(Action.RenameElement({ elementId, name }));
}

function added(action: Action, elementId: ElementId): void {
  if (!changedModel(action)) {
    return;
  }
  dispatch(Action.Select({ elementId }));
  announce(`Added ${spokenName(modelStore.getState(), elementId)}.`);
  focusElement(elementId);
}

function changedModel(action: Action): boolean {
  const before = modelStore.getState().present;
  dispatch(action);
  return modelStore.getState().present !== before;
}

function spokenName(state: State, elementId: ElementId): string {
  return accessibleNames(currentLayout(state)).get(elementId) ?? elementId;
}

function counted(total: number, thing: string): string {
  if (total === 0) {
    return `no ${thing}s`;
  }
  return total === 1 ? `1 ${thing}` : `${String(total)} ${thing}s`;
}

const drawnSelector = '.react-flow__node, .react-flow__edge';

const focusAttempts = 3;

/**
 * The element a drawn node or flow stands for, and nothing where `target` is
 * neither: React Flow marks what it drew with the element's own id, and
 * `elements` is the canvas's own map from those to the model's ids. It is how
 * a key press is read as a press on the element under it.
 */
export function drawnElement(
  target: EventTarget | null,
  elements: ReadonlyMap<string, ElementId>,
): ElementId | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }
  const drawn = target.closest(drawnSelector)?.getAttribute('data-id');
  return drawn === undefined || drawn === null
    ? undefined
    : elements.get(drawn);
}

/**
 * Puts focus on the element as the canvas drew it, which React Flow marks
 * with the element's own id. It is what an edit does after adding something,
 * and what the threat panel does when Escape hands the keyboard back to the
 * element the panel was about. A node not yet drawn is waited a frame for, so
 * a focus asked for in the same tick as the dispatch that draws it lands.
 */
export function focusElement(
  elementId: ElementId,
  attempts = focusAttempts,
): void {
  const drawn = [...document.querySelectorAll(drawnSelector)].find(
    (candidate) => candidate.getAttribute('data-id') === elementId,
  );
  if (drawn instanceof HTMLElement || drawn instanceof SVGElement) {
    drawn.focus();
    return;
  }
  if (attempts > 1) {
    requestAnimationFrame(() => {
      focusElement(elementId, attempts - 1);
    });
  }
}
