import { z } from 'zod';

/**
 * Identifier of one element in a model. Any non-empty string parses: ids
 * from foreign files (Threat Dragon cell ids, for example) pass through
 * unchanged, and UUIDs appear only in generation, never as a parse
 * constraint. Element ids must be unique across the whole model, not just
 * one diagram; that refinement lands with the parse entry point (#19). The
 * brand exists at compile time only; at runtime the value is a plain string.
 */
export const elementIdSchema = z.string().min(1).brand<'ElementId'>();

/** Branded element id. */
export type ElementId = z.infer<typeof elementIdSchema>;

/**
 * Identifier of one diagram in a model. Same contract as
 * {@link elementIdSchema}: any non-empty string parses, uniqueness across
 * the model is #19's refinement, and the brand is compile-time only.
 */
export const diagramIdSchema = z.string().min(1).brand<'DiagramId'>();

/** Branded diagram id. */
export type DiagramId = z.infer<typeof diagramIdSchema>;

/**
 * Identifier of one threat in a model. Same contract as
 * {@link elementIdSchema}: any non-empty string parses, uniqueness across
 * the model is #19's refinement, and the brand is compile-time only.
 */
export const threatIdSchema = z.string().min(1).brand<'ThreatId'>();

/** Branded threat id. */
export type ThreatId = z.infer<typeof threatIdSchema>;

/**
 * Identifier of one mitigation in a model. Same contract as
 * {@link elementIdSchema}: any non-empty string parses, uniqueness across
 * the model is #19's refinement, and the brand is compile-time only.
 */
export const mitigationIdSchema = z.string().min(1).brand<'MitigationId'>();

/** Branded mitigation id. */
export type MitigationId = z.infer<typeof mitigationIdSchema>;

/**
 * Identifier of one assumption in a model. Same contract as
 * {@link elementIdSchema}: any non-empty string parses, uniqueness across
 * the model is #19's refinement, and the brand is compile-time only.
 */
export const assumptionIdSchema = z.string().min(1).brand<'AssumptionId'>();

/** Branded assumption id. */
export type AssumptionId = z.infer<typeof assumptionIdSchema>;

/**
 * Generates a fresh element id as a UUID. Generation strategy only: parsing
 * accepts any non-empty string. Requires a secure context; crypto.randomUUID
 * is undefined on plain-http browser pages.
 */
export function generateElementId(): ElementId {
  return elementIdSchema.parse(crypto.randomUUID());
}

/**
 * Generates a fresh diagram id as a UUID. Generation strategy only: parsing
 * accepts any non-empty string. Requires a secure context; crypto.randomUUID
 * is undefined on plain-http browser pages.
 */
export function generateDiagramId(): DiagramId {
  return diagramIdSchema.parse(crypto.randomUUID());
}

/**
 * Generates a fresh threat id as a UUID. Generation strategy only: parsing
 * accepts any non-empty string. Requires a secure context; crypto.randomUUID
 * is undefined on plain-http browser pages.
 */
export function generateThreatId(): ThreatId {
  return threatIdSchema.parse(crypto.randomUUID());
}

/**
 * Generates a fresh mitigation id as a UUID. Generation strategy only:
 * parsing accepts any non-empty string. Requires a secure context;
 * crypto.randomUUID is undefined on plain-http browser pages.
 */
export function generateMitigationId(): MitigationId {
  return mitigationIdSchema.parse(crypto.randomUUID());
}

/**
 * Generates a fresh assumption id as a UUID. Generation strategy only:
 * parsing accepts any non-empty string. Requires a secure context;
 * crypto.randomUUID is undefined on plain-http browser pages.
 */
export function generateAssumptionId(): AssumptionId {
  return assumptionIdSchema.parse(crypto.randomUUID());
}
