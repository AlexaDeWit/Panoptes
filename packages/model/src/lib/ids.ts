import { z } from 'zod';

/**
 * Identifier of one element in a model.
 *
 * Any non-empty string parses: ids from foreign files (Threat Dragon cell
 * ids, for example) pass through unchanged, so UUID shape is never a parse
 * constraint. UUIDs appear only as the generation strategy of
 * {@link generateElementId}.
 *
 * An element id names its element across the whole model, not just the
 * diagram that owns it. This schema checks one id in isolation; the
 * model-wide uniqueness refinement lands with the parse entry point (#19).
 *
 * The brand separates element ids from other id kinds at compile time. At
 * runtime the value is a plain string.
 */
export const elementIdSchema = z.string().min(1).brand<'ElementId'>();

/** Branded element id, inferred from {@link elementIdSchema}. */
export type ElementId = z.infer<typeof elementIdSchema>;

/**
 * Identifier of one diagram in a model.
 *
 * Same contract as {@link elementIdSchema}: any non-empty string parses, and
 * UUIDs appear only in generation ({@link generateDiagramId}).
 */
export const diagramIdSchema = z.string().min(1).brand<'DiagramId'>();

/** Branded diagram id, inferred from {@link diagramIdSchema}. */
export type DiagramId = z.infer<typeof diagramIdSchema>;

/**
 * Generates a fresh element id as a UUID. Generation strategy only: parsing
 * accepts any non-empty string (see {@link elementIdSchema}).
 */
export function generateElementId(): ElementId {
  return elementIdSchema.parse(crypto.randomUUID());
}

/**
 * Generates a fresh diagram id as a UUID. Generation strategy only: parsing
 * accepts any non-empty string (see {@link diagramIdSchema}).
 */
export function generateDiagramId(): DiagramId {
  return diagramIdSchema.parse(crypto.randomUUID());
}
