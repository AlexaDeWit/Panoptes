import { z } from 'zod';
import { assumptionIdSchema, elementIdSchema, threatIdSchema } from './ids.js';

/**
 * Whether the assumption still holds. An invalidated assumption flags its
 * linked threats for revisiting: their analysis rested on it.
 */
export const assumptionStatusSchema = z.enum(['valid', 'invalidated']);

/** Assumption status. */
export type AssumptionStatus = z.infer<typeof assumptionStatusSchema>;

/**
 * One assumption the analysis rests on, linked to the elements and threats
 * it underpins by id. `prose` is markdown. Whether the ids resolve is
 * checked by parseModel, not here.
 */
export const assumptionSchema = z.object({
  id: assumptionIdSchema,
  prose: z.string(),
  status: assumptionStatusSchema,
  elements: z.array(elementIdSchema),
  threats: z.array(threatIdSchema),
});

/** Assumption record. */
export type Assumption = z.infer<typeof assumptionSchema>;
