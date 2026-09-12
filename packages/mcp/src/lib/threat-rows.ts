import { escapedForTerminal } from '@saerskriven/formats';
import {
  acceptedTextSchema,
  elementIdSchema,
  severitySchema,
  threatCategorySchema,
  threatIdSchema,
  threatStatusSchema,
  type Threat,
  type ThreatCategory,
} from '@saerskriven/model';
import { z } from 'zod';

/**
 * What every threat row names: the number and id a further call passes, its
 * title, where it stands, how bad it is, its category, and the elements it
 * attaches to.
 */
export const threatRowSchema = z.object({
  number: z.int().positive(),
  id: threatIdSchema,
  title: acceptedTextSchema,
  status: threatStatusSchema,
  severity: severitySchema,
  category: threatCategorySchema,
  elements: z.array(elementIdSchema),
});

/**
 * A threat row with the prose of the record, which is what a caller reads to
 * judge the threat rather than to find it.
 */
export const threatDetailSchema = threatRowSchema.extend({
  description: acceptedTextSchema.optional(),
  mitigation: acceptedTextSchema.optional(),
});

/** One threat as a search carries it. */
export type ThreatDetail = z.infer<typeof threatDetailSchema>;

/** The identifying fields of one threat. */
export function threatRow(threat: Threat): ThreatDetail {
  return {
    number: threat.number,
    id: threat.id,
    title: threat.title,
    status: threat.status,
    severity: threat.severity,
    category: threat.category,
    elements: threat.elements,
  };
}

/** One threat with the prose the record carries. */
export function threatDetail(threat: Threat): ThreatDetail {
  return {
    ...threatRow(threat),
    description: threat.description,
    mitigation: threat.mitigation,
  };
}

/**
 * The methodology and the category of a threat as one word pair. The names
 * are the model's own values rather than the display labels the markdown
 * register writes, so what a text result names is what a `category` filter
 * takes.
 */
export function renderCategory(category: ThreatCategory): string {
  return category.methodology === 'custom'
    ? `${escapedForTerminal(category.methodologyName)}/${escapedForTerminal(category.category)}`
    : `${category.methodology}/${category.category}`;
}

/**
 * One threat as the lines a text result carries: a heading line naming it,
 * and one indented line per field the row carries past the heading.
 */
export function renderThreat(row: ThreatDetail): readonly string[] {
  return [
    `  ${String(row.number)} (${row.id}): ${escapedForTerminal(row.title)}`,
    ...detailLines(row).map((line) => `    ${line}`),
  ];
}

function detailLines(row: ThreatDetail): readonly string[] {
  return [
    `status ${row.status}, severity ${row.severity}, category ${renderCategory(row.category)}`,
    `elements: ${row.elements.length === 0 ? 'none' : row.elements.join(', ')}`,
    ...(row.description === undefined || row.description.length === 0
      ? []
      : [`description: ${escapedForTerminal(row.description)}`]),
    ...(row.mitigation === undefined || row.mitigation.length === 0
      ? []
      : [`mitigation: ${escapedForTerminal(row.mitigation)}`]),
  ];
}
