import { z } from 'zod';
import { assumptionSchema } from './assumptions.js';
import { elementSchema } from './elements.js';
import { diagramIdSchema } from './ids.js';
import { mitigationSchema } from './mitigations.js';
import { threatSchema } from './threats.js';
import { acceptedTextSchema } from './text.js';

/**
 * Facts about the model as a whole: what it covers and who answers for it.
 * `title`, `owner`, and `description` are free text; empty strings are
 * allowed so a model can be saved before it is described. `contributors`
 * names everyone who worked on the model, one name per entry, and is
 * required with an empty array legal, so a model can be saved before anyone
 * is credited. Threat Dragon wraps each name in an object of its own; the
 * internal model is format-independent, so the import codec (M2) flattens
 * that wrapper to the name.
 */
export const modelMetadataSchema = z.object({
  title: acceptedTextSchema,
  owner: acceptedTextSchema,
  description: acceptedTextSchema,
  contributors: z.array(acceptedTextSchema),
});

/** Model metadata. */
export type ModelMetadata = z.infer<typeof modelMetadataSchema>;

/**
 * One diagram: a titled canvas that owns its elements, geometry inline on
 * each element. Element ids and diagram ids must each be unique across the
 * whole model; parseModel enforces both, so this schema alone accepts
 * duplicates.
 */
export const diagramSchema = z.object({
  id: diagramIdSchema,
  title: acceptedTextSchema,
  elements: z.array(elementSchema),
});

/** One diagram of a model. */
export type Diagram = z.infer<typeof diagramSchema>;

/**
 * The structural shape of a threat model root: metadata, diagrams, threats,
 * mitigations, and assumptions. Every array may be empty: a model saves
 * before it is drawn or analyzed. `lastIssuedThreatNumber` is the highest
 * threat number the model has ever issued, 0 before the first, and it
 * counts removed threats: a number names one threat permanently, so
 * removing a threat leaves a gap that is never filled. Cross-record checks
 * (id and threat-number uniqueness, reference resolution, and no threat
 * number above the last issued) are parseModel's refinements, so this
 * schema alone accepts duplicates, dangling ids, and a mark below a threat
 * it holds. Internal to the package: parseModel is the only exported way a
 * Model value comes into existence.
 */
export const modelSchema = z.object({
  metadata: modelMetadataSchema,
  diagrams: z.array(diagramSchema),
  threats: z.array(threatSchema),
  lastIssuedThreatNumber: z.int().nonnegative(),
  mitigations: z.array(mitigationSchema),
  assumptions: z.array(assumptionSchema),
});
