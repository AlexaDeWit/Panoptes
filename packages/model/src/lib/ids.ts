import { z } from 'zod';

/**
 * Shortest id the model accepts. Threat Dragon's schema refuses a cell id
 * under two characters, and an id is a reference that every threat and
 * flow repeats, so padding one on write would rename it everywhere and
 * break the round trip. Refusing at the parse boundary keeps the codecs
 * free of the case.
 */
const minimumIdLength = 2;

/**
 * Identifier of one element in a model. Any string of two or more
 * characters parses: ids from foreign files (Threat Dragon cell ids, for
 * example) pass through unchanged, and UUIDs appear only in generation,
 * never as a parse constraint. Element ids must be unique across the whole
 * model, not just one diagram; parseModel enforces that refinement. The
 * brand exists at compile time only; at runtime the value is a plain
 * string.
 */
export const elementIdSchema = z
  .string()
  .min(minimumIdLength)
  .brand<'ElementId'>();

/** Branded element id. */
export type ElementId = z.infer<typeof elementIdSchema>;

/**
 * Identifier of one diagram in a model. Same contract as
 * {@link elementIdSchema} except for length: Threat Dragon numbers its
 * diagrams from zero and the read codec keeps that number as the id, so a
 * single character must parse here.
 */
export const diagramIdSchema = z.string().min(1).brand<'DiagramId'>();

/** Branded diagram id. */
export type DiagramId = z.infer<typeof diagramIdSchema>;

/**
 * Identifier of one threat in a model. Same contract as
 * {@link elementIdSchema}; uniqueness among threats is parseModel's
 * refinement.
 */
export const threatIdSchema = z
  .string()
  .min(minimumIdLength)
  .brand<'ThreatId'>();

/** Branded threat id. */
export type ThreatId = z.infer<typeof threatIdSchema>;

/**
 * Identifier of one mitigation in a model. Same contract as
 * {@link elementIdSchema}; uniqueness among mitigations is parseModel's
 * refinement.
 */
export const mitigationIdSchema = z
  .string()
  .min(minimumIdLength)
  .brand<'MitigationId'>();

/** Branded mitigation id. */
export type MitigationId = z.infer<typeof mitigationIdSchema>;

/**
 * Identifier of one assumption in a model. Same contract as
 * {@link elementIdSchema}; uniqueness among assumptions is parseModel's
 * refinement.
 */
export const assumptionIdSchema = z
  .string()
  .min(minimumIdLength)
  .brand<'AssumptionId'>();

/** Branded assumption id. */
export type AssumptionId = z.infer<typeof assumptionIdSchema>;

const fresh = <Schema extends z.ZodType>(schema: Schema): z.infer<Schema> =>
  schema.parse(crypto.randomUUID());

/**
 * Generates a fresh element id as a UUID. Generation strategy only; parsing
 * accepts any id the schema does. Requires a secure context:
 * crypto.randomUUID is undefined on plain-http browser pages.
 */
export function generateElementId(): ElementId {
  return fresh(elementIdSchema);
}

/** Generates a fresh diagram id as a UUID, on the terms of {@link generateElementId}. */
export function generateDiagramId(): DiagramId {
  return fresh(diagramIdSchema);
}

/** Generates a fresh threat id as a UUID, on the terms of {@link generateElementId}. */
export function generateThreatId(): ThreatId {
  return fresh(threatIdSchema);
}

/** Generates a fresh mitigation id as a UUID, on the terms of {@link generateElementId}. */
export function generateMitigationId(): MitigationId {
  return fresh(mitigationIdSchema);
}

/** Generates a fresh assumption id as a UUID, on the terms of {@link generateElementId}. */
export function generateAssumptionId(): AssumptionId {
  return fresh(assumptionIdSchema);
}
