import { z } from 'zod';

/**
 * A location on the diagram canvas, in canvas units. Coordinates may be
 * negative: the origin is a reference point, not an edge.
 */
export const pointSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
});

/** Canvas location. */
export type Point = z.infer<typeof pointSchema>;

/**
 * Extent of an element on the canvas, in canvas units. Width and height are
 * strictly positive: a zero-extent element cannot be drawn or picked.
 */
export const sizeSchema = z.strictObject({
  width: z.number().positive(),
  height: z.number().positive(),
});

/** Canvas extent. */
export type Size = z.infer<typeof sizeSchema>;

/**
 * Intermediate points a flow or boundary curve passes through, in drawing
 * order. Empty leaves the routing to the renderer.
 */
export const waypointsSchema = z.array(pointSchema);

/** Ordered route points. */
export type Waypoints = z.infer<typeof waypointsSchema>;
