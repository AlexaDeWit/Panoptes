import { z } from 'zod';
import { assumptionIdSchema, elementIdSchema, threatIdSchema } from './ids.js';
import { acceptedTextSchema } from './text.js';

/**
 * Whether the assumption still holds. `unconfirmed` is an assumption no one
 * has checked yet, and it raises no flag. An `invalidated` assumption raises
 * the `rests-on-invalidated-assumption` flag on each threat it links, which
 * `threatFlags` derives.
 */
export const assumptionStatusSchema = z.enum([
  'unconfirmed',
  'valid',
  'invalidated',
]);

/** Assumption status. */
export type AssumptionStatus = z.infer<typeof assumptionStatusSchema>;

/**
 * One assumption the analysis rests on, linked to the elements and threats
 * it underpins by id. `prose` is markdown. Whether the ids resolve is
 * checked by parseModel, not here.
 */
export const assumptionSchema = z.object({
  id: assumptionIdSchema,
  prose: acceptedTextSchema,
  status: assumptionStatusSchema,
  elements: z.array(elementIdSchema),
  threats: z.array(threatIdSchema),
});

/** Assumption record. */
export type Assumption = z.infer<typeof assumptionSchema>;
