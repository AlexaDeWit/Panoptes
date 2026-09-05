import type { CanvasLayout, CanvasNode } from '@panoptes/canvas';
import {
  generateElementId,
  type Element,
  type ElementId,
  type Point,
  type Size,
} from '@panoptes/model';

/**
 * The element kinds the palette adds, one button each: five of the canvas's
 * own kinds rather than the model's, because the two shapes a trust boundary
 * takes are drawn, added and reasoned about separately while the model holds
 * them under one kind. The sixth the canvas draws, a text note, has no button
 * until there is somewhere to type its prose.
 */
export const paletteKinds = [
  'actor',
  'process',
  'store',
  'boundary-box',
  'boundary-curve',
] as const;

/** One kind of element the palette adds. */
export type PaletteKind = (typeof paletteKinds)[number];

/**
 * What each palette button says, and what the element it adds is called. One
 * map, so the words a person presses are the words they then hear on the
 * canvas and read on the diagram.
 */
export const paletteNames = {
  actor: 'New actor',
  process: 'New process',
  store: 'New store',
  'boundary-box': 'New trust boundary',
  'boundary-curve': 'New trust boundary curve',
} as const satisfies Record<PaletteKind, string>;

/** What a flow drawn on the canvas is called until something renames it. */
export const newFlowName = 'New flow';

/**
 * The elements a flow can run between: the actors, processes and stores the
 * diagram draws. A trust boundary is what a flow crosses rather than an end
 * of one, and a text element is a note about the diagram rather than a part
 * of the system, which is why the model refuses a threat on one. Both ways of
 * connecting read this, so neither offers an end the other refuses, and a
 * flow is not among them at all, the layout having no geometry for a flow
 * that ends on a flow.
 */
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
} as const satisfies Record<PaletteKind, Size>;

const rowGap = 40;

/**
 * Where the palette puts a new element: at the left edge of the diagram, a
 * gap below everything it draws. `bounds` is the ink the diagram lays down,
 * so nothing at all is drawn there whatever the diagram holds, and the added
 * element joins that ink, which puts the next one below it again.
 */
export function freePosition(layout: CanvasLayout): Point {
  return {
    x: layout.bounds.x,
    y: layout.bounds.y + layout.bounds.height + rowGap,
  };
}

/**
 * One new element of `kind`, at `position`, with a fresh id. Every field the
 * model demands is filled in: an element arrives named, in scope, and
 * described by nothing, since the studio has no place to type a description
 * yet.
 */
export function freshElement(kind: PaletteKind, position: Point): Element {
  const named = {
    id: generateElementId(),
    name: paletteNames[kind],
    description: '',
    outOfScope: false,
    reasonOutOfScope: '',
  };
  const size = nominalSizes[kind];
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
