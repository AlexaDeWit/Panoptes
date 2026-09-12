import { z } from 'zod';
import {
  actorSchema,
  processSchema,
  storeSchema,
  flowSchema,
  trustBoundarySchema,
} from './elements.js';

/** A property edit keeps omitted fields and clears fields explicitly set to undefined. */
export const elementPropertiesSchema = z.discriminatedUnion('kind', [
  actorSchema.pick({ kind: true, providesAuthentication: true }),
  processSchema.pick({
    kind: true,
    handlesCardPayment: true,
    handlesGoodsOrServices: true,
    isWebApplication: true,
    privilegeLevel: true,
  }),
  storeSchema.pick({
    kind: true,
    isALog: true,
    isEncrypted: true,
    isSigned: true,
    storesCredentials: true,
    storesInventory: true,
  }),
  flowSchema.pick({
    kind: true,
    protocol: true,
    isEncrypted: true,
    isPublicNetwork: true,
    trustBoundaryIds: true,
  }),
  trustBoundarySchema.pick({
    kind: true,
    containedElements: true,
    crossingFlows: true,
  }),
]);

/** Element-specific fields accepted by a property edit. */
export type ElementProperties = z.infer<typeof elementPropertiesSchema>;
