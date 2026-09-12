import { renderThemeSchema } from '@saerskriven/canvas';
import { z } from 'zod';

/** The starting level belongs to the first generated heading that is included. */
export const registerOptionsSchema = z.object({
  title: z.boolean().optional(),
  headingLevel: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ])
    .optional(),
});

/** Markdown appearance controls do not alter the register's semantic content. */
export const markdownOptionsSchema = registerOptionsSchema.extend({
  theme: renderThemeSchema.optional(),
  styled: z.boolean().optional(),
  stylesheet: z.boolean().optional(),
});

/** Heading controls shared by portable and styled registers. */
export type RegisterOptions = z.infer<typeof registerOptionsSchema>;

/** Styled Markdown can carry its scoped stylesheet or use the host's own. */
export type MarkdownOptions = z.infer<typeof markdownOptionsSchema>;
