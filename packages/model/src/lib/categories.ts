import { z } from 'zod';

/**
 * A STRIDE category: one of the six threat classes of Microsoft's STRIDE
 * methodology. Écluse's threats all use this variant.
 */
export const strideCategorySchema = z.object({
  methodology: z.literal('STRIDE'),
  category: z.enum([
    'spoofing',
    'tampering',
    'repudiation',
    'information-disclosure',
    'denial-of-service',
    'elevation-of-privilege',
  ]),
});

/** STRIDE category. */
export type StrideCategory = z.infer<typeof strideCategorySchema>;

/**
 * A LINDDUN category: one of the seven privacy threat types of the LINDDUN
 * methodology.
 */
export const linddunCategorySchema = z.object({
  methodology: z.literal('LINDDUN'),
  category: z.enum([
    'linking',
    'identifying',
    'non-repudiation',
    'detecting',
    'data-disclosure',
    'unawareness',
    'non-compliance',
  ]),
});

/** LINDDUN category. */
export type LinddunCategory = z.infer<typeof linddunCategorySchema>;

/**
 * A CIA category: one of the three classic information-security properties
 * the threat endangers.
 */
export const ciaCategorySchema = z.object({
  methodology: z.literal('CIA'),
  category: z.enum(['confidentiality', 'integrity', 'availability']),
});

/** CIA category. */
export type CiaCategory = z.infer<typeof ciaCategorySchema>;

/**
 * A CIA-DIE category: the CIA properties plus the DIE triad (distributed,
 * immutable, ephemeral).
 */
export const ciaDieCategorySchema = z.object({
  methodology: z.literal('CIA-DIE'),
  category: z.enum([
    'confidentiality',
    'integrity',
    'availability',
    'distributed',
    'immutable',
    'ephemeral',
  ]),
});

/** CIA-DIE category. */
export type CiaDieCategory = z.infer<typeof ciaDieCategorySchema>;

/**
 * A PLOT4ai category: one of the eight categories the PLOT4ai library
 * publishes (https://plot4.ai/library, backed by deck.json in
 * https://github.com/PLOT4ai/plot4ai-library). Threat Dragon ships an older
 * eight-category PLOT4ai set; categories from that set that are absent here
 * are carried by the custom variant instead.
 */
export const plot4aiCategorySchema = z.object({
  methodology: z.literal('PLOT4ai'),
  category: z.enum([
    'accountability-and-human-oversight',
    'bias-fairness-and-discrimination',
    'cybersecurity',
    'data-and-data-governance',
    'ethics-and-human-rights',
    'privacy-and-data-protection',
    'safety-and-environmental-impact',
    'transparency-and-accessibility',
  ]),
});

/** PLOT4ai category. */
export type Plot4aiCategory = z.infer<typeof plot4aiCategorySchema>;

/**
 * A category from a methodology this model does not enumerate. Both names
 * are free text and non-empty: an unnamed methodology or category carries no
 * information.
 */
export const customCategorySchema = z.object({
  methodology: z.literal('custom'),
  methodologyName: z.string().min(1),
  category: z.string().min(1),
});

/** Custom category. */
export type CustomCategory = z.infer<typeof customCategorySchema>;

/**
 * The category of a threat, discriminated on `methodology`: a known
 * methodology's enumerated set, or the custom escape hatch.
 */
export const threatCategorySchema = z.discriminatedUnion('methodology', [
  strideCategorySchema,
  linddunCategorySchema,
  ciaCategorySchema,
  ciaDieCategorySchema,
  plot4aiCategorySchema,
  customCategorySchema,
]);

/** Threat category. */
export type ThreatCategory = z.infer<typeof threatCategorySchema>;
