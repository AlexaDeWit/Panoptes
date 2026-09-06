import type { CanvasLayout, CanvasNode } from '@saerskriven/canvas';
import {
  generateElementId,
  type Element,
  type ElementId,
  type Point,
  type Size,
} from '@saerskriven/model';

/** The five element shapes that the toolbox places. */
export const elementTools = [
  'actor',
  'process',
  'store',
  'boundary-box',
  'boundary-curve',
] as const;

/** One kind of element the toolbox places. */
export type ElementTool = (typeof elementTools)[number];

/** What each placed element is called until it is renamed. */
export const placeholderNames = {
  actor: 'New actor',
  process: 'New process',
  store: 'New store',
  'boundary-box': 'New trust boundary',
  'boundary-curve': 'New trust boundary curve',
} as const satisfies Record<ElementTool, string>;

/** What a flow drawn on the canvas is called until something renames it. */
export const newFlowName = 'New flow';

/** The actors, processes and stores that a flow can connect. */
export function flowEnds(layout: CanvasLayout): CanvasNode[] {
  return layout.nodes.filter(
    (node) =>
      node.kind === 'actor' || node.kind === 'process' || node.kind === 'store',
  );
}

const nominalSizes = {
  actor: { width: 120, height: 60 },
  process: { width: 120, height: 60 },
  store: { width: 120, height: 60 },
  'boundary-box': { width: 240, height: 160 },
  'boundary-curve': { width: 240, height: 80 },
} as const satisfies Record<ElementTool, Size>;

/** The screen-pixel movement below which a placement remains a click. */
export const placementClickDistance = 4;

/** The default size of an element placed by a click or by Enter. */
export function defaultSize(kind: ElementTool): Size {
  return nominalSizes[kind];
}

/** A default-sized element centred on `centre`. */
export function centredPlacement(
  kind: ElementTool,
  centre: Point,
): { readonly position: Point; readonly size: Size } {
  const size = defaultSize(kind);
  return {
    position: {
      x: centre.x - size.width / 2,
      y: centre.y - size.height / 2,
    },
    size,
  };
}

/**
 * An element sized between opposite corners. A process takes the shorter
 * side, so the box it gives the circular glyph is square. A zero side is
 * kept drawable at one model unit rather than asking the model for a zero
 * extent it refuses.
 */
export function draggedPlacement(
  kind: Exclude<ElementTool, 'boundary-curve'>,
  from: Point,
  to: Point,
): { readonly position: Point; readonly size: Size } {
  const width = Math.max(Math.abs(to.x - from.x), 1);
  const height = Math.max(Math.abs(to.y - from.y), 1);
  if (kind === 'process') {
    const side = Math.min(width, height);
    return {
      position: {
        x: to.x < from.x ? from.x - side : from.x,
        y: to.y < from.y ? from.y - side : from.y,
      },
      size: { width: side, height: side },
    };
  }
  return {
    position: { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y) },
    size: { width, height },
  };
}

/** The geometry a completed pointer press asks an element tool to place. */
export function pointerPlacement(
  kind: Exclude<ElementTool, 'boundary-curve'>,
  from: Point,
  to: Point,
  screenDistance: number,
): { readonly position: Point; readonly size: Size } {
  return screenDistance < placementClickDistance
    ? centredPlacement(kind, from)
    : draggedPlacement(kind, from, to);
}

/** The default boundary curve centred on a click or on the viewport. */
export function defaultCurveWaypoints(centre: Point): readonly Point[] {
  const placed = centredPlacement('boundary-curve', centre);
  return arch(placed.position, placed.size);
}

/** A new element with its required defaults and a fresh id. */
export function freshElement(
  kind: ElementTool,
  position: Point,
  size: Size = defaultSize(kind),
): Element {
  const named = {
    id: generateElementId(),
    name: placeholderNames[kind],
    description: '',
    outOfScope: false,
    reasonOutOfScope: '',
  };
  if (kind === 'boundary-box') {
    return {
      ...named,
      kind: 'trust-boundary',
      shape: { kind: 'box', position, size },
    };
  }
  if (kind === 'boundary-curve') {
    return {
      ...named,
      kind: 'trust-boundary',
      shape: { kind: 'curve', waypoints: arch(position, size) },
    };
  }
  return { ...named, kind, position, size };
}

/** A boundary curve through the waypoints a person committed. */
export function freshBoundaryCurve(waypoints: readonly Point[]): Element {
  return {
    id: generateElementId(),
    kind: 'trust-boundary',
    name: placeholderNames['boundary-curve'],
    description: '',
    outOfScope: false,
    reasonOutOfScope: '',
    shape: { kind: 'curve', waypoints: [...waypoints] },
  };
}

/**
 * One new flow between two elements, with a fresh id and no waypoints, which
 * leaves the route to the layout. Both ends are attached: a flow the canvas
 * draws between two elements is what either way of connecting asks for.
 */
export function freshFlow(source: ElementId, target: ElementId): Element {
  return {
    kind: 'flow',
    id: generateElementId(),
    name: newFlowName,
    description: '',
    outOfScope: false,
    reasonOutOfScope: '',
    source: { kind: 'attached', element: source },
    target: { kind: 'attached', element: target },
    waypoints: [],
  };
}

function arch(position: Point, size: Size): Point[] {
  return [
    { x: position.x, y: position.y + size.height },
    { x: position.x + size.width / 2, y: position.y },
    { x: position.x + size.width, y: position.y + size.height },
  ];
}
