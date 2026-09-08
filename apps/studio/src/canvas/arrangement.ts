import { boxOfPoints, type CanvasNode } from '@saerskriven/canvas';
import { z } from 'zod';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import { announce } from './announcements.js';
import { currentLayout } from './layout.js';

const arrangementSchema = z.enum([
  'left',
  'centre',
  'right',
  'top',
  'middle',
  'bottom',
  'horizontal',
  'vertical',
]);
/** Alignment and distribution operations offered by the registry. */
export type Arrangement = z.infer<typeof arrangementSchema>;

/** Computes node offsets against selection bounds or equal gaps between fixed outer nodes. */
export function arrangementMoves(
  nodes: readonly CanvasNode[],
  operation: Arrangement,
): Extract<Action, { _tag: 'ArrangeElements' }>['moves'] {
  if (nodes.length < 2) {
    return [];
  }
  const bounds = boxOfPoints(
    nodes.flatMap((node) => [
      node.position,
      {
        x: node.position.x + node.size.width,
        y: node.position.y + node.size.height,
      },
    ]),
  );
  if (bounds === undefined) {
    return [];
  }
  if (operation === 'horizontal' || operation === 'vertical') {
    if (nodes.length < 3) {
      return [];
    }
    const axis = operation === 'horizontal' ? 'x' : 'y';
    const extent = operation === 'horizontal' ? 'width' : 'height';
    const ordered = [...nodes];
    ordered.sort(
      (a, b) => a.position[axis] - b.position[axis] || a.id.localeCompare(b.id),
    );
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const occupied = ordered.reduce(
      (total, node) => total + node.size[extent],
      0,
    );
    const gap =
      (last.position[axis] +
        last.size[extent] -
        first.position[axis] -
        occupied) /
      (ordered.length - 1);
    let at = first.position[axis] + first.size[extent] + gap;
    return ordered.slice(1, -1).map((node) => {
      const offset = { x: 0, y: 0, [axis]: at - node.position[axis] };
      at += node.size[extent] + gap;
      return { elementId: node.id, offset };
    });
  }
  return nodes.map((node) => {
    const offset = { x: 0, y: 0 };
    switch (operation) {
      case 'left':
        offset.x = bounds.minX - node.position.x;
        break;
      case 'centre':
        offset.x =
          (bounds.minX + bounds.maxX - node.size.width) / 2 - node.position.x;
        break;
      case 'right':
        offset.x = bounds.maxX - node.size.width - node.position.x;
        break;
      case 'top':
        offset.y = bounds.minY - node.position.y;
        break;
      case 'middle':
        offset.y =
          (bounds.minY + bounds.maxY - node.size.height) / 2 - node.position.y;
        break;
      case 'bottom':
        offset.y = bounds.maxY - node.size.height - node.position.y;
        break;
    }
    return { elementId: node.id, offset };
  });
}

/** Arranges selected nodes in one undo step. Flows retain their bends and attachments. */
export function arrangeSelected(operation: Arrangement): void {
  const state = modelStore.getState();
  const nodes = currentLayout(state).nodes.filter((node) =>
    state.selection.includes(node.id),
  );
  const moves = arrangementMoves(nodes, operation);
  dispatch(Action.ArrangeElements({ moves }));
  if (modelStore.getState().present !== state.present) {
    announce(
      `Arranged ${String(nodes.length)} nodes. Flow bends and free endpoints stayed in place.`,
    );
  }
}
