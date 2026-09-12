import {
  acceptedTextSchema,
  actorSchema,
  autoExtent,
  autoPlacement,
  elementIdSchema,
  elementPropertiesSchema,
  flowSchema,
  pointSchema,
  processSchema,
  sizeSchema,
  storeSchema,
  textSchema,
  trustBoundarySchema,
  waypointsSchema,
  type Element,
  type ElementProperties,
} from '@saerskriven/model';
import { z } from 'zod';

const creationDefaults = z.object({
  id: elementIdSchema,
  name: acceptedTextSchema,
  description: acceptedTextSchema.default(''),
  outOfScope: z.boolean().default(false),
  reasonOutOfScope: acceptedTextSchema.default(''),
});

const placementSchema = z.union([
  z.literal('auto'),
  z.object({ position: pointSchema, size: sizeSchema }),
]);

const placedDefaults = creationDefaults.extend({
  placement: placementSchema.describe(
    'A position and size, or "auto" for the next place on the shared grid.',
  ),
});

/** Creation keeps model fields, replacing node geometry with the placement choice. */
export const addedElementSchema = z.discriminatedUnion('kind', [
  actorSchema.omit({ position: true, size: true }).extend(placedDefaults.shape),
  processSchema
    .omit({ position: true, size: true })
    .extend(placedDefaults.shape),
  storeSchema.omit({ position: true, size: true }).extend(placedDefaults.shape),
  textSchema.omit({ position: true, size: true }).extend(placedDefaults.shape),
  trustBoundarySchema.extend(creationDefaults.shape),
  flowSchema.extend(creationDefaults.shape).extend({
    waypoints: waypointsSchema.default([]),
    bidirectional: z.boolean().default(false),
  }),
]);

const propertyNames = [
  ...new Set(
    elementPropertiesSchema.options.flatMap(
      (variant) => variant.keyof().options,
    ),
  ),
].filter((name) => name !== 'kind');

/** JSON names cleared fields explicitly because it cannot encode undefined. */
export const propertyEditSchema = z.object({
  properties: elementPropertiesSchema,
  unset: z
    .array(z.enum(propertyNames))
    .optional()
    .describe(
      'Fields to clear back to not recorded. Each must belong to the element kind and must not also have a supplied value.',
    ),
});

/** Clearing uses only this kind's fields and cannot also assign them. */
export function consistentPropertyEdit(
  input: z.infer<typeof propertyEditSchema>,
): boolean {
  const allowed = new Set<string>(
    elementPropertiesSchema.options.flatMap((variant) =>
      variant.shape.kind.value === input.properties.kind
        ? variant.keyof().options
        : [],
    ),
  );
  return (input.unset ?? []).every(
    (field) => allowed.has(field) && !Object.hasOwn(input.properties, field),
  );
}

/** Resolves placement without discarding optional model properties. */
export function addedElement(
  input: z.infer<typeof addedElementSchema>,
  index: number,
): Element {
  if (!('placement' in input)) return input;
  const { placement, ...element } = input;
  return {
    ...element,
    ...(placement === 'auto'
      ? { position: autoPlacement(index), size: autoExtent }
      : placement),
  };
}

/** Converts the explicit JSON clearing list into the model's property patch. */
export function editedProperties(
  input: z.infer<typeof propertyEditSchema>,
): ElementProperties {
  return Object.assign(
    { ...input.properties },
    Object.fromEntries((input.unset ?? []).map((field) => [field, undefined])),
  );
}
