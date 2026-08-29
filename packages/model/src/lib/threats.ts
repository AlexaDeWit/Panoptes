import { z } from 'zod';
import { threatCategorySchema } from './categories.js';
import { elementIdSchema, threatIdSchema } from './ids.js';

/**
 * Lifecycle of a threat. Écluse's Open, Mitigated, and Accepted map onto the
 * first three; `not-applicable` exists for Threat Dragon's NotApplicable,
 * making the import (#27) total against Threat Dragon 2.6.2 releases.
 * Threat Dragon's unreleased main adds Transferred, Avoided, and Eliminated,
 * which have no home here.
 */
export const threatStatusSchema = z.enum([
  'open',
  'mitigated',
  'accepted-risk',
  'not-applicable',
]);

/** Threat status. */
export type ThreatStatus = z.infer<typeof threatStatusSchema>;

/**
 * How bad the threat is if realized. Écluse uses the first four; `tbd` is
 * Threat Dragon's fifth value, kept so the import (#27) stays total.
 */
export const severitySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
  'tbd',
]);

/** Threat severity. */
export type Severity = z.infer<typeof severitySchema>;

/**
 * One threat, a first-class record of the model rather than a child of one
 * diagram cell (Threat Dragon nests threats per cell; this record attaches
 * to any number of elements by id instead). `description` and `mitigation`
 * are markdown prose. Threat numbers must be unique across the model and
 * element ids must resolve; both refinements land with the parse entry point
 * (#19), so this schema alone accepts duplicates and dangling ids.
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
