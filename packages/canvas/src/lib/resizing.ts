import type { NodeBox } from './handles.js';

/** Positions of the four side controls and four corner controls. */
export const resizeControlPositions = [
  'top',
  'right',
  'bottom',
  'left',
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
] as const;

/** One position from which a node can be resized. */
export type ResizeControlPosition = (typeof resizeControlPositions)[number];

/** The minimum model-space width and height of a resized node. */
export const minimumNodeExtent = 10;

/** The model-space distance of one keyboard resize. */
export const keyboardResizeStep = 5;

/** The model-space distance of one shifted keyboard resize. */
export const shiftedKeyboardResizeStep = 20;

const resizeKeys = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'] as const;

type ResizeKey = (typeof resizeKeys)[number];

const isResizeKey = (key: string): key is ResizeKey =>
  resizeKeys.some((candidate) => candidate === key);

/**
 * Resizes one edge of `box` by an arrow key while the opposite edge stays
 * fixed. Returns nothing when the key does not apply or the box cannot shrink.
 */
export function resizeBoxByKey(
  box: NodeBox,
  control: ResizeControlPosition,
  key: string,
  step = keyboardResizeStep,
): NodeBox | undefined {
  if (!isResizeKey(key)) {
    return undefined;
  }
  const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
  const requested = key === 'ArrowLeft' || key === 'ArrowUp' ? -step : step;
  const changed = horizontal
    ? resizeOnHorizontalAxis(box, control, requested)
    : resizeOnVerticalAxis(box, control, requested);
  if (changed === undefined) {
    return undefined;
  }
  return changed.position.x === box.position.x &&
    changed.position.y === box.position.y &&
    changed.size.width === box.size.width &&
    changed.size.height === box.size.height
    ? undefined
    : changed;
}

/** Keeps the untouched axis of a side resize at its model value. */
export function resizeBoxOnControlAxes(
  box: NodeBox,
  control: ResizeControlPosition,
  resized: NodeBox,
): NodeBox {
  if (control === 'left' || control === 'right') {
    return {
      position: { x: resized.position.x, y: box.position.y },
      size: { width: resized.size.width, height: box.size.height },
    };
  }
  if (control === 'top' || control === 'bottom') {
    return {
      position: { x: box.position.x, y: resized.position.y },
      size: { width: box.size.width, height: resized.size.height },
    };
  }
  return resized;
}

function resizeOnHorizontalAxis(
  box: NodeBox,
  control: ResizeControlPosition,
  requested: number,
): NodeBox | undefined {
  const edge = horizontalEdge(control);
  return edge === undefined
    ? undefined
    : resizeHorizontal(box, edge, requested);
}

function resizeOnVerticalAxis(
  box: NodeBox,
  control: ResizeControlPosition,
  requested: number,
): NodeBox | undefined {
  const edge = verticalEdge(control);
  return edge === undefined ? undefined : resizeVertical(box, edge, requested);
}

function horizontalEdge(
  control: ResizeControlPosition,
): 'left' | 'right' | undefined {
  if (control.includes('left')) {
    return 'left';
  }
  return control.includes('right') ? 'right' : undefined;
}

function verticalEdge(
  control: ResizeControlPosition,
): 'top' | 'bottom' | undefined {
  if (control.includes('top')) {
    return 'top';
  }
  return control.includes('bottom') ? 'bottom' : undefined;
}

function resizeHorizontal(
  box: NodeBox,
  edge: 'left' | 'right',
  requested: number,
): NodeBox {
  if (edge === 'left') {
    const moved = Math.min(requested, box.size.width - minimumNodeExtent);
    return {
      position: { ...box.position, x: box.position.x + moved },
      size: { ...box.size, width: box.size.width - moved },
    };
  }
  const moved = Math.max(requested, minimumNodeExtent - box.size.width);
  return {
    position: box.position,
    size: { ...box.size, width: box.size.width + moved },
  };
}

function resizeVertical(
  box: NodeBox,
  edge: 'top' | 'bottom',
  requested: number,
): NodeBox {
  if (edge === 'top') {
    const moved = Math.min(requested, box.size.height - minimumNodeExtent);
    return {
      position: { ...box.position, y: box.position.y + moved },
      size: { ...box.size, height: box.size.height - moved },
    };
  }
  const moved = Math.max(requested, minimumNodeExtent - box.size.height);
  return {
    position: box.position,
    size: { ...box.size, height: box.size.height + moved },
  };
}
