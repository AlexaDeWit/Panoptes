import { z } from 'zod';
import {
  pointSchema,
  sideSchema,
  sizeSchema,
  waypointsSchema,
} from './geometry.js';
import { elementIdSchema } from './ids.js';
import { acceptedTextSchema } from './text.js';

const elementBaseSchema = z.object({
  id: elementIdSchema,
  name: acceptedTextSchema,
  description: acceptedTextSchema,
  outOfScope: z.boolean(),
  reasonOutOfScope: acceptedTextSchema,
});

const nodeBaseSchema = elementBaseSchema.extend({
  position: pointSchema,
  size: sizeSchema,
});

/** External actor. Security facts remain unknown when absent. */
export const actorSchema = nodeBaseSchema.extend({
  kind: z.literal('actor'),
  providesAuthentication: z.boolean().optional(),
});

/** Actor element. */
export type Actor = z.infer<typeof actorSchema>;

/** Process security facts remain unknown when absent. */
export const processSchema = nodeBaseSchema.extend({
  kind: z.literal('process'),
  handlesCardPayment: z.boolean().optional(),
  handlesGoodsOrServices: z.boolean().optional(),
  isWebApplication: z.boolean().optional(),
  privilegeLevel: acceptedTextSchema.optional(),
});

/** Process element. */
export type Process = z.infer<typeof processSchema>;

/** Data at rest. Security facts remain unknown when absent. */
export const storeSchema = nodeBaseSchema.extend({
  kind: z.literal('store'),
  isALog: z.boolean().optional(),
  isEncrypted: z.boolean().optional(),
  isSigned: z.boolean().optional(),
  storesCredentials: z.boolean().optional(),
  storesInventory: z.boolean().optional(),
});

/** Store element. */
export type Store = z.infer<typeof storeSchema>;

/** Canvas note with separate content and outline name. */
export const textSchema = nodeBaseSchema.extend({
  kind: z.literal('text'),
  text: acceptedTextSchema,
});

/** Canvas text element. */
export type TextElement = z.infer<typeof textSchema>;

/** An attached endpoint uses the renderer's choice when no side is set. */
export const attachedEndpointSchema = z.object({
  kind: z.literal('attached'),
  element: elementIdSchema,
  side: sideSchema.optional(),
});

/** Attached flow endpoint. */
export type AttachedEndpoint = z.infer<typeof attachedEndpointSchema>;

/** A flow endpoint at a free canvas position. */
export const freeEndpointSchema = z.object({
  kind: z.literal('free'),
  position: pointSchema,
});

/** Free flow endpoint. */
export type FreeEndpoint = z.infer<typeof freeEndpointSchema>;

/** An attached or free flow endpoint. */
export const flowEndpointSchema = z.discriminatedUnion('kind', [
  attachedEndpointSchema,
  freeEndpointSchema,
]);

/** Flow endpoint. */
export type FlowEndpoint = z.infer<typeof flowEndpointSchema>;

/** Flow direction is required. Absent security facts and relationship lists remain unknown. */
export const flowSchema = elementBaseSchema.extend({
  kind: z.literal('flow'),
  protocol: acceptedTextSchema.optional(),
  isEncrypted: z.boolean().optional(),
  isPublicNetwork: z.boolean().optional(),
  trustBoundaryIds: z.array(elementIdSchema).optional(),
  source: flowEndpointSchema,
  target: flowEndpointSchema,
  waypoints: waypointsSchema,
  bidirectional: z.boolean(),
});

/** Flow element. */
export type Flow = z.infer<typeof flowSchema>;

/** Rectangular trust boundary with positive extents. */
export const boxBoundaryShapeSchema = z.object({
  kind: z.literal('box'),
  position: pointSchema,
  size: sizeSchema,
});

/** Box boundary shape. */
export type BoxBoundaryShape = z.infer<typeof boxBoundaryShapeSchema>;

/** Open boundary curve through at least two points. */
export const curveBoundaryShapeSchema = z.object({
  kind: z.literal('curve'),
  waypoints: waypointsSchema.min(2),
});

/** Curve boundary shape. */
export type CurveBoundaryShape = z.infer<typeof curveBoundaryShapeSchema>;

/** Trust boundary geometry. */
export const boundaryShapeSchema = z.discriminatedUnion('kind', [
  boxBoundaryShapeSchema,
  curveBoundaryShapeSchema,
]);

/** Trust boundary shape. */
export type BoundaryShape = z.infer<typeof boundaryShapeSchema>;

/** Declared relationships are independent of geometry and remain unknown when absent. */
export const trustBoundarySchema = elementBaseSchema.extend({
  kind: z.literal('trust-boundary'),
  containedElements: z.array(elementIdSchema).optional(),
  crossingFlows: z.array(elementIdSchema).optional(),
  shape: boundaryShapeSchema,
});

/** Trust boundary element. */
export type TrustBoundary = z.infer<typeof trustBoundarySchema>;

/** Element-specific security facts are optional. A canvas note carries no threats. */
export const elementSchema = z.discriminatedUnion('kind', [
  actorSchema,
  processSchema,
  storeSchema,
  flowSchema,
  trustBoundarySchema,
  textSchema,
]);

/** Any diagram element. */
export type Element = z.infer<typeof elementSchema>;
