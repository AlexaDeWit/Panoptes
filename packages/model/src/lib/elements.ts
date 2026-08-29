import { z } from 'zod';
import { pointSchema, sizeSchema, waypointsSchema } from './geometry.js';
import { elementIdSchema } from './ids.js';

// Fields every element kind carries. `name` allows the empty string because
// imported diagrams may hold unnamed cells.
const elementBase = {
  id: elementIdSchema,
  name: z.string(),
};

// Fields shared by the node kinds (actor, process, store): a box on the
// canvas.
const nodeBase = {
  ...elementBase,
  position: pointSchema,
  size: sizeSchema,
};

/**
 * An external entity: a person or system outside the modelled system that
 * exchanges data with it.
 */
export const actorSchema = z.strictObject({
  kind: z.literal('actor'),
  ...nodeBase,
});

/** Actor element, inferred from {@link actorSchema}. */
export type Actor = z.infer<typeof actorSchema>;

/**
 * A part of the modelled system that receives, transforms, or routes data.
 */
export const processSchema = z.strictObject({
  kind: z.literal('process'),
  ...nodeBase,
});

/** Process element, inferred from {@link processSchema}. */
export type Process = z.infer<typeof processSchema>;

/**
 * Data at rest: a database, cache, queue, or file store.
 */
export const storeSchema = z.strictObject({
  kind: z.literal('store'),
  ...nodeBase,
});

/** Store element, inferred from {@link storeSchema}. */
export type Store = z.infer<typeof storeSchema>;

/**
 * A flow endpoint fastened to an element, referenced by id. Whether the id
 * resolves to an element of the model is checked by the parse entry point
 * (#19), not here.
 */
export const attachedEndpointSchema = z.strictObject({
  kind: z.literal('attached'),
  element: elementIdSchema,
});

/** Attached flow endpoint, inferred from {@link attachedEndpointSchema}. */
export type AttachedEndpoint = z.infer<typeof attachedEndpointSchema>;

/**
 * A flow endpoint at a bare canvas position, connected to no element.
 * Imported diagrams contain these: Threat Dragon lets a flow start or end on
 * empty canvas.
 */
export const freeEndpointSchema = z.strictObject({
  kind: z.literal('free'),
  position: pointSchema,
});

/** Free flow endpoint, inferred from {@link freeEndpointSchema}. */
export type FreeEndpoint = z.infer<typeof freeEndpointSchema>;

/**
 * Where a flow starts or ends: on an element, or at a free canvas position.
 */
export const flowEndpointSchema = z.discriminatedUnion('kind', [
  attachedEndpointSchema,
  freeEndpointSchema,
]);

/** Flow endpoint, inferred from {@link flowEndpointSchema}. */
export type FlowEndpoint = z.infer<typeof flowEndpointSchema>;

/**
 * Data in motion between a source and a target endpoint.
 */
export const flowSchema = z.strictObject({
  kind: z.literal('flow'),
  ...elementBase,
  source: flowEndpointSchema,
  target: flowEndpointSchema,
  waypoints: waypointsSchema,
});

/** Flow element, inferred from {@link flowSchema}. */
export type Flow = z.infer<typeof flowSchema>;

/**
 * Rectangular trust boundary shape.
 */
export const boxBoundaryShapeSchema = z.strictObject({
  kind: z.literal('box'),
  position: pointSchema,
  size: sizeSchema,
});

/** Box boundary shape, inferred from {@link boxBoundaryShapeSchema}. */
export type BoxBoundaryShape = z.infer<typeof boxBoundaryShapeSchema>;

/**
 * Freehand trust boundary shape: an open curve through its waypoints.
 * Threat Dragon draws boundary curves as well as boxes, so both variants are
 * part of the model.
 */
export const curveBoundaryShapeSchema = z.strictObject({
  kind: z.literal('curve'),
  waypoints: waypointsSchema,
});

/** Curve boundary shape, inferred from {@link curveBoundaryShapeSchema}. */
export type CurveBoundaryShape = z.infer<typeof curveBoundaryShapeSchema>;

/**
 * Geometry of a trust boundary: a box or a freehand curve.
 */
export const boundaryShapeSchema = z.discriminatedUnion('kind', [
  boxBoundaryShapeSchema,
  curveBoundaryShapeSchema,
]);

/** Trust boundary shape, inferred from {@link boundaryShapeSchema}. */
export type BoundaryShape = z.infer<typeof boundaryShapeSchema>;

/**
 * A line across which the level of trust changes. Elements are not
 * containment-linked to a boundary; membership is visual.
 */
export const trustBoundarySchema = z.strictObject({
  kind: z.literal('trust-boundary'),
  ...elementBase,
  shape: boundaryShapeSchema,
});

/** Trust boundary element, inferred from {@link trustBoundarySchema}. */
export type TrustBoundary = z.infer<typeof trustBoundarySchema>;

/**
 * Any element a diagram can hold, discriminated on `kind`.
 */
export const elementSchema = z.discriminatedUnion('kind', [
  actorSchema,
  processSchema,
  storeSchema,
  flowSchema,
  trustBoundarySchema,
]);

/** Diagram element, inferred from {@link elementSchema}. */
export type Element = z.infer<typeof elementSchema>;
