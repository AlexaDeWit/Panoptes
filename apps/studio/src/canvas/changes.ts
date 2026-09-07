import type { CanvasFlowEdge, CanvasNode } from '@saerskriven/canvas';
import type { ElementId } from '@saerskriven/model';
import type { Connection, Edge, EdgeChange, NodeChange } from '@xyflow/react';
import { Action } from '../store/actions.js';
import { selectedElements } from '../store/selectors.js';
import { dispatch, modelStore } from '../store/store.js';
import { connectElements } from './edits.js';
import type { DiagramNode } from './nodes.js';

/** One thing React Flow reports about a node or a flow it draws. */
export type DiagramChange =
  | NodeChange<DiagramNode>
  | EdgeChange<CanvasFlowEdge>;

/**
 * Turns what React Flow reports about a gesture into store actions and
 * dispatches them. The selection it works from is the store's own at the
 * moment of the call, never a value a render closed over: React Flow reports
 * a click that moves the selection between a node and a flow as two
 * synchronous calls, one selecting and one deselecting, with no render
 * between them, so a caller holding the older selection would clear what the
 * first call had just selected.
 */
export function applyChanges(
  changes: readonly DiagramChange[],
  elements: ReadonlyMap<string, ElementId>,
  nodes: ReadonlyMap<string, CanvasNode>,
): void {
  const selection = selectedElements(modelStore.getState());
  for (const action of [
    ...selectionActions(changes, elements, selection),
    ...moveActions(changes, nodes, selection),
  ]) {
    dispatch(action);
  }
}

/**
 * The selection React Flow reports, folded onto the current store selection.
 * Node and edge changes arrive through separate callbacks, so each call uses
 * the selection that the prior callback left behind.
 */
export function selectionActions(
  changes: readonly DiagramChange[],
  elements: ReadonlyMap<string, ElementId>,
  selection: readonly ElementId[],
): Action[] {
  const next = [...selection];
  for (const change of changes) {
    if (change.type !== 'select') {
      continue;
    }
    const element = elements.get(change.id);
    if (element === undefined) {
      continue;
    }
    const index = next.indexOf(element);
    if (change.selected && index === -1) {
      next.push(element);
    } else if (!change.selected && index !== -1) {
      next.splice(index, 1);
    }
  }
  return sameSelection(selection, next)
    ? []
    : [Action.Select({ elementIds: next })];
}

/**
 * The moves the reported changes ask for, as offsets from where the model
 * has each element. React Flow reports a position on every frame of a drag
 * and once more when the gesture ends, so a change still dragging is the
 * canvas's own business and only the settled one reaches the store: one store
 * action for a whole drag, and one for each arrow key a keyboard move
 * presses. A gesture that put an element back where it was asks for nothing,
 * since an operation that changes no geometry still costs an undo entry.
 */
export function moveActions(
  changes: readonly DiagramChange[],
  nodes: ReadonlyMap<string, CanvasNode>,
  selection: readonly ElementId[],
): Action[] {
  const resizing = new Set(
    changes.flatMap((change) =>
      change.type === 'dimensions' && change.resizing === true
        ? [change.id]
        : [],
    ),
  );
  const settled = changes.flatMap((change) => {
    if (
      change.type !== 'position' ||
      change.dragging === true ||
      change.position === undefined ||
      resizing.has(change.id)
    ) {
      return [];
    }
    const node = nodes.get(change.id);
    if (node === undefined) {
      return [];
    }
    const offset = {
      x: change.position.x - node.position.x,
      y: change.position.y - node.position.y,
    };
    return offset.x === 0 && offset.y === 0
      ? []
      : [{ elementId: node.id, offset }];
  });
  const first = settled.at(0);
  if (first === undefined) {
    return [];
  }
  const elementIds = selection.includes(first.elementId)
    ? selection
    : [first.elementId];
  return elementIds.length === 1
    ? [Action.MoveElement(first)]
    : [Action.MoveElements({ elementIds, offset: first.offset })];
}

/**
 * The elements whose geometry moves during the reported gesture. A resize
 * changes one node even when the store holds a multi-selection.
 */
export function gestureSelection(
  changes: readonly DiagramChange[],
  nodes: ReadonlyMap<string, CanvasNode>,
  selection: readonly ElementId[],
): readonly ElementId[] {
  const resized = new Set(
    changes.flatMap((change) => {
      if (change.type !== 'dimensions' || change.resizing === undefined) {
        return [];
      }
      const node = nodes.get(change.id);
      return node === undefined ? [] : [node.id];
    }),
  );
  return resized.size === 0 ? selection : [...resized];
}

/**
 * Whether a connection React Flow is drawing runs between two different
 * elements. It is React Flow's own test while the gesture is in flight, so a
 * drag that would end where it started is refused as it is drawn rather than
 * silently doing nothing: the layout resolves both ends of such a flow to one
 * handle and would draw no line at all.
 */
export function betweenTwoElements(connection: Connection | Edge): boolean {
  return connection.source !== connection.target;
}

/**
 * Draws the flow a settled connection asks for. React Flow names each end by
 * the id of the node the gesture reached, so an end naming no element of the
 * diagram, a free end's anchor among them, asks for nothing.
 */
export function applyConnection(
  connection: Connection,
  elements: ReadonlyMap<string, ElementId>,
): void {
  const source = elements.get(connection.source);
  const target = elements.get(connection.target);
  if (source !== undefined && target !== undefined) {
    connectElements(source, target);
  }
}

function sameSelection(
  before: readonly ElementId[],
  after: readonly ElementId[],
): boolean {
  return (
    before.length === after.length &&
    before.every((elementId, index) => elementId === after[index])
  );
}
