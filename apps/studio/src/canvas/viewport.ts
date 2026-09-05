import type { CanvasNode } from '@panoptes/canvas';
import type { Viewport } from '@xyflow/react';

/** How much of the page the canvas has, in its own pixels. */
export type CanvasExtent = {
  readonly width: number;
  readonly height: number;
};

/**
 * Whether the whole of a node is drawn inside the canvas at the viewport
 * given. React Flow places a node by scaling the model's own coordinates and
 * translating them, which is the arithmetic here, so nothing is measured and
 * the answer holds before the node is drawn.
 */
export function nodeInView(
  node: CanvasNode,
  viewport: Viewport,
  extent: CanvasExtent,
): boolean {
  const left = node.position.x * viewport.zoom + viewport.x;
  const top = node.position.y * viewport.zoom + viewport.y;
  return (
    left >= 0 &&
    top >= 0 &&
    left + node.size.width * viewport.zoom <= extent.width &&
    top + node.size.height * viewport.zoom <= extent.height
  );
}
