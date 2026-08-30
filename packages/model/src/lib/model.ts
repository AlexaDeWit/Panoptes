import { z } from 'zod';
import { assumptionSchema } from './assumptions.js';
import { elementSchema } from './elements.js';
import { diagramIdSchema } from './ids.js';
import { mitigationSchema } from './mitigations.js';
import { threatSchema } from './threats.js';

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
 * whole model; parseModel enforces both, so this schema alone accepts
 * duplicates.
 */
export const diagramSchema = z.strictObject({
  id: diagramIdSchema,
  title: z.string(),
  elements: z.array(elementSchema),
});

/** One diagram of a model. */
export type Diagram = z.infer<typeof diagramSchema>;

/**
 * The structural shape of a threat model root: metadata, diagrams, threats,
 * mitigations, and assumptions. Every array may be empty: a model saves
 * before it is drawn or analyzed. Cross-record checks (id and threat-number
 * uniqueness, reference resolution) are parseModel's refinements, so this
 * schema alone accepts duplicates and dangling ids. Internal to the package:
 * parseModel is the only exported way a Model value comes into existence.
 */
export const modelSchema = z.strictObject({
  metadata: modelMetadataSchema,
  diagrams: z.array(diagramSchema),
  threats: z.array(threatSchema),
  mitigations: z.array(mitigationSchema),
  assumptions: z.array(assumptionSchema),
});
