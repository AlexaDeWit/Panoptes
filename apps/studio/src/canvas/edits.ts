import type { ElementId, Model, Point, Size } from '@saerskriven/model';
import { Action } from '../store/actions.js';
import {
  elementById,
  firstDiagramId,
  nameEditable,
  renameable,
  selectedElement,
} from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { announce } from './announcements.js';
import {
  flowEnds,
  freshBoundaryCurve,
  freshElement,
  freshFlow,
  type ElementTool,
} from './elements.js';
import { currentLayout } from './layout.js';
import { accessibleNames } from './names.js';
import { elementIds } from './nodes.js';

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

/** Places and selects one element, then opens its placeholder name. */
export function placeElement(
  kind: Exclude<ElementTool, 'boundary-curve'>,
  position: Point,
  size: Size,
): boolean {
  const state = modelStore.getState();
  const diagramId = firstDiagramId(state);
  if (diagramId === undefined) {
    return false;
  }
  const element = freshElement(kind, position, size);
  return placed(Action.AddElement({ diagramId, element }), element.id);
}

/** Places a trust-boundary curve through its committed waypoints. */
export function placeBoundaryCurve(waypoints: readonly Point[]): boolean {
  const state = modelStore.getState();
  const diagramId = firstDiagramId(state);
  if (diagramId === undefined || waypoints.length < 2) {
    return false;
  }
  const element = freshBoundaryCurve(waypoints);
  return placed(Action.AddElement({ diagramId, element }), element.id);
}

/**
 * Draws a flow between two valid ends. This rejects other element kinds
 * before the model can retain a flow that the layout cannot draw.
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

/** Removes the selection and announces its combined cascade once. */
export function removeSelected(): boolean {
  const state = modelStore.getState();
  const selection = state.selection;
  if (selection.length === 0) {
    return false;
  }
  const one = selection.at(0);
  const name =
    selection.length === 1 && one !== undefined
      ? spokenName(state, one)
      : counted(selection.length, 'element');
  const cascade = removalCascade(state.present, selection);
  const action =
    selection.length === 1 && one !== undefined
      ? Action.RemoveElement({ elementId: one })
      : Action.RemoveElements({ elementIds: selection });
  if (!changedModel(action)) {
    return false;
  }
  announce(describeRemoval(name, cascade));
  return true;
}

/** Counts affected flows and removed threat links before a removal. */
export function removalCascade(
  model: Model,
  removedIds: ElementId | readonly ElementId[],
): RemovalCascade {
  const removed = new Set(
    Array.isArray(removedIds) ? removedIds : [removedIds],
  );
  const flows = model.diagrams
    .flatMap((diagram) => diagram.elements)
    .filter(
      (element) =>
        element.kind === 'flow' &&
        !removed.has(element.id) &&
        [element.source, element.target].some(
          (endpoint) =>
            endpoint.kind === 'attached' && removed.has(endpoint.element),
        ),
    ).length;
  const threats = model.threats.reduce(
    (count, threat) =>
      count +
      threat.elements.filter((elementId) => removed.has(elementId)).length,
    0,
  );
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
  const elementId = selectedElement(state);
  if (elementId !== undefined && renameable(state)) {
    dispatch(Action.Renaming({ elementId }));
  }
}

/** Selects every element in the diagram on screen. */
export function selectAll(): void {
  const layout = currentLayout(modelStore.getState());
  const selected = [...new Set(elementIds(layout).values())];
  dispatch(Action.Select({ elementIds: selected }));
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
  dispatch(Action.Select({ elementIds: [elementId] }));
  focusElement(elementId);
}

function placed(action: Action, elementId: ElementId): boolean {
  if (!changedModel(action)) {
    return false;
  }
  dispatch(Action.Select({ elementIds: [elementId] }));
  dispatch(Action.Renaming({ elementId }));
  return true;
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
    if (attempts > 1) {
      setTimeout(() => {
        focusElement(elementId, attempts - 1);
      }, 0);
    }
    return;
  }
  if (attempts > 1) {
    requestAnimationFrame(() => {
      focusElement(elementId, attempts - 1);
    });
  }
}
