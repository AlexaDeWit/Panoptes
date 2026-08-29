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

/** Model metadata. */
export type ModelMetadata = z.infer<typeof modelMetadataSchema>;

/**
 * One diagram: a titled canvas that owns its elements, geometry inline on
 * each element. Element ids and diagram ids must each be unique across the
 * whole model; both refinements land with the parse entry point (#19), so
 * this schema alone accepts duplicates.
 */
export const diagramSchema = z.strictObject({
  id: diagramIdSchema,
  title: z.string(),
  elements: z.array(elementSchema),
});

/** One diagram of a model. */
export type Diagram = z.infer<typeof diagramSchema>;

/**
 * The root of a threat model: metadata plus the diagrams. A model with no
 * diagrams and a diagram with no elements are both legal: a model saves
 * before it is drawn. Threats, mitigations, and assumptions are added by a
 * later slice (#18).
 */
export const modelSchema = z.strictObject({
  metadata: modelMetadataSchema,
  diagrams: z.array(diagramSchema),
});

/** Threat model root. */
export type Model = z.infer<typeof modelSchema>;
