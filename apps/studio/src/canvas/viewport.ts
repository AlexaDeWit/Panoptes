import {
  centreOf,
  panelCover,
  type CanvasBounds,
  type CanvasNode,
} from '@panoptes/canvas';
import type { Point } from '@panoptes/model';
import type { Viewport } from '@xyflow/react';

/** How much of the page the canvas has, in its own pixels. */
export type CanvasExtent = {
  readonly width: number;
  readonly height: number;
};

/**
 * What a fit leaves clear between the diagram and the edge of the canvas, in
 * pixels of the page. It is the room the floating chrome sits in, the zoom
 * cluster bottom right among it, and the toolbox of issue 175 reads the same
 * number, so the two agree on how much room that chrome takes.
 */
export const canvasPadding = 64;

/**
 * How far the canvas zooms either way. React Flow is given the same pair, so
 * a fit cannot land outside the range a later zoom gesture snaps back into.
 * Its own floor of 0.5 is not far enough out to draw a real model whole.
 */
export const zoomLimits = { minimum: 0.1, maximum: 2 } as const;

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

/**
 * The part of the canvas an element is drawn in the clear of while the threat
 * panel is open, which is everything left of the panel. The panel is open
 * whenever an element is selected, and a selection moving is what pans, so
 * every pan is computed against this rather than against the whole canvas.
 * What the panel covers is the token module's `panelCover`, which is also
 * what the panel is drawn from ([the visual
 * system](../../../../packages/canvas/README.md#the-visual-system)), so the
 * two cannot differ.
 */
export function clearOfPanel(extent: CanvasExtent): CanvasExtent {
  return {
    width: Math.max(extent.width - panelCover, 0),
    height: extent.height,
  };
}

/**
 * Where the view is centred to draw `node` in {@link clearOfPanel}: the
 * node's own centre, carried right by half of what the panel covers, so the
 * node lands in the middle of what is left rather than under the panel's
 * inside edge.
 */
export function revealCentre(node: CanvasNode, zoom: number): Point {
  const centre = centreOf(node);
  return { x: centre.x + panelCover / 2 / zoom, y: centre.y };
}

/**
 * The viewport that draws the whole of `bounds` inside `extent`, centred,
 * with {@link canvasPadding} clear on every side, and nothing at all where
 * there is no ink to fit or no room left to fit it into. The zoom is held
 * inside {@link zoomLimits}, so a diagram far smaller than the canvas is not
 * blown up past what a zoom gesture then reaches, and one so large that
 * fitting it would go below the floor is drawn at the floor with whatever
 * room that leaves rather than with the padding clear.
 */
export function fitViewport(
  bounds: CanvasBounds,
  extent: CanvasExtent,
): Viewport | undefined {
  const room = {
    width: extent.width - canvasPadding * 2,
    height: extent.height - canvasPadding * 2,
  };
  if (
    room.width <= 0 ||
    room.height <= 0 ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return undefined;
  }
  const zoom = held(
    Math.min(room.width / bounds.width, room.height / bounds.height),
  );
  return {
    x: extent.width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: extent.height / 2 - (bounds.y + bounds.height / 2) * zoom,
    zoom,
  };
}

function held(zoom: number): number {
  return Math.min(Math.max(zoom, zoomLimits.minimum), zoomLimits.maximum);
}
