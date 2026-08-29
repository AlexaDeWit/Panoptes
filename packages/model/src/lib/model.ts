import { z } from 'zod';
import { elementSchema } from './elements.js';
import { diagramIdSchema } from './ids.js';

/**
 * Facts about the model as a whole: what it covers and who answers for it.
 * All three fields are free text; empty strings are allowed so a model can
 * be saved before it is described.
 */
export const modelMetadataSchema = z.strictObject({
  title: z.string(),
  owner: z.string(),
  description: z.string(),
});

/** Model metadata, inferred from {@link modelMetadataSchema}. */
export type ModelMetadata = z.infer<typeof modelMetadataSchema>;

/**
 * One diagram: a titled canvas that owns its elements, geometry inline on
 * each element. Element ids must be unique across the whole model, not just
 * within one diagram; that refinement lands with the parse entry point
 * (#19), so this schema alone accepts duplicates.
 */
export const diagramSchema = z.strictObject({
  id: diagramIdSchema,
  title: z.string(),
  elements: z.array(elementSchema),
});

/** Diagram, inferred from {@link diagramSchema}. */
export type Diagram = z.infer<typeof diagramSchema>;

/**
 * The root of a threat model: metadata plus the diagrams. Threats,
 * mitigations, and assumptions are added by a later slice (#18).
 */
export const modelSchema = z.strictObject({
  metadata: modelMetadataSchema,
  diagrams: z.array(diagramSchema),
});

/** Threat model root, inferred from {@link modelSchema}. */
export type Model = z.infer<typeof modelSchema>;
