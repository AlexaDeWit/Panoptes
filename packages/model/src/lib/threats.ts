import { z } from 'zod';
import { threatCategorySchema } from './categories.js';
import { elementIdSchema, threatIdSchema } from './ids.js';

/**
 * Where a threat stands. `open` is the threat nobody has dispositioned yet.
 * The four that follow are the standard risk treatments: reduce it
 * (`mitigated`), move it to someone else such as an insurer or a supplier
 * (`transferred`), remove the feature or path that creates it (`avoided`),
 * or carry it knowingly (`accepted-risk`). `eliminated` is the threat a
 * change has made impossible rather than merely unlikely, which is a
 * stronger claim than mitigation and worth recording as one.
 * `not-applicable` is the threat that never applied to this system, which
 * is a judgement about the analysis rather than about the risk.
 */
export const threatStatusSchema = z.enum([
  'open',
  'mitigated',
  'transferred',
  'avoided',
  'accepted-risk',
  'eliminated',
  'not-applicable',
]);

/** Threat status. */
export type ThreatStatus = z.infer<typeof threatStatusSchema>;

/**
 * How bad the threat is if realized. `undecided` is a state of its own
 * rather than a missing value: a threat recorded while the system is still
 * being designed often has no defensible severity yet, and saying so is
 * more use than guessing one.
 */
export const severitySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
  'undecided',
]);

/** Threat severity. */
export type Severity = z.infer<typeof severitySchema>;

/**
 * One threat, a first-class record of the model rather than a child of one
 * diagram cell (Threat Dragon nests threats per cell; this record attaches
 * to any number of elements by id instead). `description` and `mitigation`
 * are markdown prose. Threat numbers must be unique across the model and
 * element ids must resolve; parseModel enforces both, so this schema alone
 * accepts duplicates and dangling ids.
 */
export const threatSchema = z.strictObject({
  id: threatIdSchema,
  number: z.int().positive(),
  title: z.string(),
  category: threatCategorySchema,
  severity: severitySchema,
  status: threatStatusSchema,
  description: z.string(),
  mitigation: z.string(),
  elements: z.array(elementIdSchema),
});

/** Threat record. */
export type Threat = z.infer<typeof threatSchema>;
