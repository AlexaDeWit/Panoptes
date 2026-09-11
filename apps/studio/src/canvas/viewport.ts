import type { CanvasBounds } from '@saerskriven/canvas';
import type { Viewport } from '@xyflow/react';

/** How much of the page the canvas has, in its own pixels. */
export type CanvasExtent = {
  readonly width: number;
  readonly height: number;
};

/** Space reserved around a fitted diagram for floating controls, in screen pixels. */
export const canvasPadding = 64;

/** Zoom bounds shared with React Flow. */
export const zoomLimits = { minimum: 0.1, maximum: 2 } as const;

/** The canvas area left of the measured pane coverage. */
export function clearOfPanel(
  extent: CanvasExtent,
  panelCover: number,
): CanvasExtent {
  return {
    width: Math.max(extent.width - panelCover, 0),
    height: extent.height,
  };
}

/** Fits the diagram inside the padded canvas, within the zoom bounds. Returns nothing when either has no area. */
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
