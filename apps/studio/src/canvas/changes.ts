import type { CanvasFlowEdge, CanvasNode } from '@panoptes/canvas';
import type { ElementId } from '@panoptes/model';
import type { EdgeChange, NodeChange } from '@xyflow/react';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import { selectedElement } from './layout.js';
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
  const selection = selectedElement(modelStore.getState());
  for (const action of [
    ...selectionActions(changes, elements, selection),
    ...moveActions(changes, nodes),
  ]) {
    dispatch(action);
  }
}

/**
 * The selection the reported changes ask for, which is one action or none:
 * the studio holds a single selection, so a change of it is one dispatch
 * however many elements React Flow reports. A click on one element is
 * reported as a selection there and a deselection everywhere else, in two
 * calls where both a node and a flow are involved, so a deselection reaches
 * the store only when it names the element the store has. `selection` is
 * therefore the store's live one, which {@link applyChanges} reads for every
 * call rather than passing the same value to both.
 */
export function selectionActions(
  changes: readonly DiagramChange[],
  elements: ReadonlyMap<string, ElementId>,
  selection: ElementId | undefined,
): Action[] {
  const chosen = selectionIds(changes, true).at(0);
  if (chosen !== undefined) {
    const element = elements.get(chosen);
    return element === undefined || element === selection
      ? []
      : [Action.Select({ elementId: element })];
  }
  const dropped =
    selection !== undefined && selectionIds(changes, false).includes(selection);
  return dropped ? [Action.Select({ elementId: undefined })] : [];
}

/**
 * The moves the reported changes ask for, as offsets from where the model
 * has each element. React Flow reports a position on every frame of a drag
 * and once more when the gesture ends, so a change still dragging is the
 * canvas's own business and only the settled one reaches the store: one
 * action for a whole drag, and one for each arrow key a keyboard move
 * presses. A gesture that put an element back where it was asks for nothing,
 * since an operation that changes no geometry still costs an undo entry.
 */
export function moveActions(
  changes: readonly DiagramChange[],
  nodes: ReadonlyMap<string, CanvasNode>,
): Action[] {
  return changes.flatMap((change) => {
    if (
      change.type !== 'position' ||
      change.dragging === true ||
      change.position === undefined
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
      : [Action.MoveElement({ elementId: node.id, offset })];
  });
}

function selectionIds(
  changes: readonly DiagramChange[],
  selected: boolean,
): string[] {
  return changes.flatMap((change) =>
    change.type === 'select' && change.selected === selected ? [change.id] : [],
  );
}
