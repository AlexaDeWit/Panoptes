import { z } from 'zod';

/**
 * A location on the diagram canvas, in canvas units. Coordinates may be
 * negative: the origin is a reference point, not an edge.
 */
export const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

/** Canvas location. */
export type Point = z.infer<typeof pointSchema>;

/**
 * Extent of an element on the canvas, in canvas units. Width and height are
 * strictly positive: a zero-extent element cannot be drawn or picked.
 */
export const sizeSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

/** Canvas extent. */
export type Size = z.infer<typeof sizeSchema>;

/** The sides of a box, in the order a tie between them breaks. */
export const sides = ['top', 'right', 'bottom', 'left'] as const;

/**
 * One side of a box, where a flow endpoint attaches and where a resize
 * control sits.
 */
export const sideSchema = z.enum(sides);

/** Side of a box. */
export type Side = z.infer<typeof sideSchema>;

/**
 * Intermediate points a flow or boundary curve passes through, in drawing
 * order. On a flow, an empty list leaves the routing to the renderer.
 */
export const waypointsSchema = z.array(pointSchema);

/** Ordered route points. */
export type Waypoints = z.infer<typeof waypointsSchema>;

const placementColumns = 4;
const placementMargin = 60;
const placementStep = { x: 260, y: 160 };

/**
 * Where to put the element at `index` among a run of elements the caller
 * has no position for: a row-major grid of four columns, laid out from a
 * fixed margin so the same index always lands on the same spot. Import
 * mappings place a record whose source file carries no geometry with it,
 * and so does an editor asked to choose a position.
 */
export function autoPlacement(index: number): Point {
  return {
    x: placementMargin + (index % placementColumns) * placementStep.x,
    y: placementMargin + Math.floor(index / placementColumns) * placementStep.y,
  };
}
