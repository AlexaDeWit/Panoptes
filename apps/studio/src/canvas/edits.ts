import type { CanvasNode, NodeBox } from '@saerskriven/canvas';
import type { Element, ElementId, Model, Point } from '@saerskriven/model';
import { Action } from '../store/actions.js';
import {
  activeDiagramId,
  elementById,
  renameable,
  selectedElement,
} from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { announce } from './announcements.js';
import { flowEnds, freshBoundaryCurve, freshFlow } from './elements.js';
import { currentLayout } from './layout.js';
import { accessibleNames } from './names.js';
import { elementIds } from './nodes.js';

/** Counts flows detached and threat links dropped by removal. */
export type RemovalCascade = {
  readonly flows: number;
  readonly threats: number;
};

/** Places and selects one element, then opens its inline editor when asked. */
export function placeElement(element: Element, openNameField = true): boolean {
  const state = modelStore.getState();
  const diagramId = activeDiagramId(state);
  if (diagramId === undefined) {
    return false;
  }
  return placed(
    Action.AddElement({ diagramId, element }),
    element.id,
    element.kind === 'text' ? 'note' : openNameField ? 'name' : undefined,
  );
}

/** Places a trust-boundary curve through its committed waypoints. */
export function placeBoundaryCurve(waypoints: readonly Point[]): boolean {
  const state = modelStore.getState();
  const diagramId = activeDiagramId(state);
  if (diagramId === undefined || waypoints.length < 2) {
    return false;
  }
  const element = freshBoundaryCurve(waypoints);
  return placed(Action.AddElement({ diagramId, element }), element.id, 'name');
}

/** Draws a flow between two connectable elements. */
export function connectElements(source: ElementId, target: ElementId): void {
  const state = modelStore.getState();
  const diagramId = activeDiagramId(state);
  const ends = new Set(flowEnds(currentLayout(state)).map((node) => node.id));
  if (diagramId === undefined || !ends.has(source) || !ends.has(target)) {
    return;
  }
  const flow = freshFlow(source, target);
  added(Action.AddElement({ diagramId, element: flow }), flow.id);
}

/** Makes the selected flow bidirectional, or one-way again, as one undo step. */
export function toggleFlowDirection(): void {
  const state = modelStore.getState();
  const elementId = selectedElement(state);
  const flow =
    elementId === undefined ? undefined : elementById(state, elementId);
  if (flow?.kind !== 'flow') {
    return;
  }
  const bidirectional = !flow.bidirectional;
  if (
    changedModel(Action.SetFlowDirection({ elementId: flow.id, bidirectional }))
  ) {
    announce(
      bidirectional
        ? `${flow.name || 'The flow'} now runs both ways.`
        : `${flow.name || 'The flow'} now runs one way.`,
    );
  }
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

/** Describes removal with explicit counts, including zero. */
export function describeRemoval(name: string, cascade: RemovalCascade): string {
  const flows = counted(cascade.flows, 'flow');
  const threats = counted(cascade.threats, 'threat link');
  return `Removed ${name}. ${flows} detached, ${threats} dropped.`;
}

/** Opens the selected element's inline editor when its text is editable. */
export function renameSelected(): void {
  const state = modelStore.getState();
  const elementId = selectedElement(state);
  if (elementId !== undefined && renameable(state)) {
    beginEditingText(elementId);
  }
}

/** Selects every element in the diagram on screen. */
export function selectAll(): void {
  const layout = currentLayout(modelStore.getState());
  const selected = [...new Set(elementIds(layout).values())];
  dispatch(Action.Select({ elementIds: selected }));
}

/** Opens the text drawn on one canvas element for editing. */
export function beginEditingText(elementId: ElementId): boolean {
  const element = elementById(modelStore.getState(), elementId);
  if (element === undefined) {
    return false;
  }
  dispatch(
    Action.InlineEditing({
      editor: { kind: element.kind === 'text' ? 'note' : 'name', elementId },
    }),
  );
  return true;
}

/** Closes the inline editor and returns focus to its element. */
export function endInlineEditing(elementId: ElementId): void {
  dispatch(Action.InlineEditing({ editor: undefined }));
  focusElement(elementId);
}

/** Closes the inline editor without changing focus after blur. */
export function stopInlineEditing(): void {
  dispatch(Action.InlineEditing({ editor: undefined }));
}

/** Renames an element as one undo step, skipping unchanged names. */
export function commitRename(elementId: ElementId, name: string): void {
  const element = elementById(modelStore.getState(), elementId);
  if (element === undefined || element.name === name) {
    return;
  }
  dispatch(Action.RenameElement({ elementId, name }));
}

/** Changes the prose drawn by one canvas note. */
export function commitNote(elementId: ElementId, text: string): void {
  const element = elementById(modelStore.getState(), elementId);
  if (element?.kind !== 'text' || element.text === text) {
    return;
  }
  dispatch(Action.EditNote({ elementId, text }));
}

/** Applies a node's new position and size as one undoable resize. */
export function resizeNode(node: CanvasNode, box: NodeBox): void {
  if (
    node.position.x === box.position.x &&
    node.position.y === box.position.y &&
    node.size.width === box.size.width &&
    node.size.height === box.size.height
  ) {
    return;
  }
  dispatch(
    Action.ResizeElement({
      elementId: node.id,
      offset: {
        x: box.position.x - node.position.x,
        y: box.position.y - node.position.y,
      },
      size: box.size,
    }),
  );
}

function added(action: Action, elementId: ElementId): void {
  if (!changedModel(action)) {
    return;
  }
  dispatch(Action.Select({ elementIds: [elementId] }));
  focusElement(elementId);
}

function placed(
  action: Action,
  elementId: ElementId,
  editor: 'name' | 'note' | undefined,
): boolean {
  if (!changedModel(action)) {
    return false;
  }
  dispatch(Action.Select({ elementIds: [elementId] }));
  if (editor !== undefined) {
    dispatch(Action.InlineEditing({ editor: { kind: editor, elementId } }));
  } else {
    focusElement(elementId);
  }
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

/** Resolves a drawn node or flow through the current layout's ID map. */
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

/** Focuses a drawn element, retrying across renders until state or focus changes. */
export function focusElement(
  elementId: ElementId,
  attempts = focusAttempts,
): void {
  const state = modelStore.getState();
  const drawn = [...document.querySelectorAll(drawnSelector)].find(
    (candidate) => candidate.getAttribute('data-id') === elementId,
  );
  if (drawn instanceof HTMLElement || drawn instanceof SVGElement) {
    drawn.focus();
  }
  if (attempts <= 1) {
    return;
  }
  const focused = document.activeElement;
  const retry = (): void => {
    if (
      modelStore.getState() === state &&
      (document.activeElement === focused ||
        document.activeElement === document.body)
    ) {
      focusElement(elementId, attempts - 1);
    }
  };
  if (drawn instanceof HTMLElement || drawn instanceof SVGElement) {
    setTimeout(retry, 0);
  } else {
    requestAnimationFrame(retry);
  }
}
