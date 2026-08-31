import { z } from 'zod';
import { pointSchema, sizeSchema, waypointsSchema } from './geometry.js';
import { elementIdSchema } from './ids.js';

const elementBaseSchema = z.strictObject({
  id: elementIdSchema,
  name: z.string(),
  description: z.string(),
  outOfScope: z.boolean(),
  reasonOutOfScope: z.string(),
});

const nodeBaseSchema = elementBaseSchema.extend({
  position: pointSchema,
  size: sizeSchema,
});

/**
 * An external entity: a person or system outside the modelled system that
 * exchanges data with it.
 */
export const actorSchema = nodeBaseSchema.extend({
  kind: z.literal('actor'),
});

/** Actor element. */
export type Actor = z.infer<typeof actorSchema>;

/**
 * A part of the modelled system that receives, transforms, or routes data.
 */
export const processSchema = nodeBaseSchema.extend({
  kind: z.literal('process'),
});

/** Process element. */
export type Process = z.infer<typeof processSchema>;

/**
 * Data at rest: a database, cache, queue, or file store.
 */
export const storeSchema = nodeBaseSchema.extend({
  kind: z.literal('store'),
});

/** Store element. */
export type Store = z.infer<typeof storeSchema>;

/**
 * A flow endpoint fastened to an element, referenced by id. Whether the id
 * resolves to an element of the flow's own diagram is checked by parseModel,
 * not here.
 */
export const attachedEndpointSchema = z.strictObject({
  kind: z.literal('attached'),
  element: elementIdSchema,
});

/** Attached flow endpoint. */
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

/** Free flow endpoint. */
export type FreeEndpoint = z.infer<typeof freeEndpointSchema>;

/**
 * Where a flow starts or ends: on an element, or at a free canvas position.
 */
export const flowEndpointSchema = z.discriminatedUnion('kind', [
  attachedEndpointSchema,
  freeEndpointSchema,
]);

/** Flow endpoint. */
export type FlowEndpoint = z.infer<typeof flowEndpointSchema>;

/**
 * Data in motion between a source and a target endpoint. `waypoints` is
 * required, never defaulted: an importer synthesizes an empty list when the
 * source file carries none.
 */
export const flowSchema = elementBaseSchema.extend({
  kind: z.literal('flow'),
  source: flowEndpointSchema,
  target: flowEndpointSchema,
  waypoints: waypointsSchema,
});

/** Flow element. */
export type Flow = z.infer<typeof flowSchema>;

/**
 * Rectangular trust boundary shape. Size extents are strictly positive.
 */
export const boxBoundaryShapeSchema = z.strictObject({
  kind: z.literal('box'),
  position: pointSchema,
  size: sizeSchema,
});

/** Box boundary shape. */
export type BoxBoundaryShape = z.infer<typeof boxBoundaryShapeSchema>;

/**
 * Freehand trust boundary shape: an open curve through at least two
 * waypoints (a curve through fewer cannot be drawn). Threat Dragon draws
 * boundary curves as well as boxes, so both variants are part of the model.
 */
export const curveBoundaryShapeSchema = z.strictObject({
  kind: z.literal('curve'),
  waypoints: waypointsSchema.min(2),
});

/** Curve boundary shape. */
export type CurveBoundaryShape = z.infer<typeof curveBoundaryShapeSchema>;

/**
 * Geometry of a trust boundary: a box or a freehand curve.
 */
export const boundaryShapeSchema = z.discriminatedUnion('kind', [
  boxBoundaryShapeSchema,
  curveBoundaryShapeSchema,
]);

/** Trust boundary shape. */
export type BoundaryShape = z.infer<typeof boundaryShapeSchema>;

/**
 * A line across which the level of trust changes. Elements are not
 * containment-linked to a boundary; membership is visual.
 */
export const trustBoundarySchema = elementBaseSchema.extend({
  kind: z.literal('trust-boundary'),
  shape: boundaryShapeSchema,
});

/** Trust boundary element. */
export type TrustBoundary = z.infer<typeof trustBoundarySchema>;

/**
 * Any element a diagram can hold, discriminated on `kind`. Every kind
 * carries a name, a description, and the scoping pair `outOfScope` and
 * `reasonOutOfScope`; the empty string is allowed throughout because
 * imported diagrams may hold unnamed or undescribed cells, and
 * `reasonOutOfScope` is by convention empty while the element is in scope
 * (no schema refinement ties the pair together). Threat Dragon's per-type
 * flags (isEncrypted, isPublicNetwork, protocol, privilegeLevel,
 * storesCredentials, and kin) and its persisted boundary membership
 * (trustBoundaryIds, containedElements, crossingFlows) are deliberately not
 * modelled; M2's wire schema declares them, so they live in the wire
 * document rather than here.
 */
export const elementSchema = z.discriminatedUnion('kind', [
  actorSchema,
  processSchema,
  storeSchema,
  flowSchema,
  trustBoundarySchema,
]);

/** Any diagram element. */
export type Element = z.infer<typeof elementSchema>;
