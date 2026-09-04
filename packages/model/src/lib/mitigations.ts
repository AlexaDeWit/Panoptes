import { z } from 'zod';
import { mitigationIdSchema, threatIdSchema } from './ids.js';
import { acceptedTextSchema } from './text.js';

/**
 * Progress of a mitigation: proposed on paper, implemented in the system, or
 * verified to work.
 */
export const mitigationStatusSchema = z.enum([
  'proposed',
  'implemented',
  'verified',
]);

/** Mitigation status. */
export type MitigationStatus = z.infer<typeof mitigationStatusSchema>;

/**
 * One piece of mitigating work, addressing any number of threats by id.
 * Threat Dragon has no such record; a threat's own `mitigation` prose stays
 * on the threat regardless. `prose` is markdown. Whether the threat ids
 * resolve is checked by parseModel, not here.
 */
export const mitigationSchema = z.object({
  id: mitigationIdSchema,
  title: acceptedTextSchema,
  prose: acceptedTextSchema,
  status: mitigationStatusSchema,
  threats: z.array(threatIdSchema),
});

/** Mitigation record. */
export type Mitigation = z.infer<typeof mitigationSchema>;
