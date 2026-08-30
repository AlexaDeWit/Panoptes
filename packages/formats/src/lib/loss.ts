import {
  assumptionIdSchema,
  diagramIdSchema,
  elementIdSchema,
  mitigationIdSchema,
  threatIdSchema,
} from '@panoptes/model';
import { z } from 'zod';

const modelSubjectSchema = z.strictObject({ kind: z.literal('model') });

const diagramSubjectSchema = z.strictObject({
  kind: z.literal('diagram'),
  id: diagramIdSchema,
});

const elementSubjectSchema = z.strictObject({
  kind: z.literal('element'),
  id: elementIdSchema,
});

const threatSubjectSchema = z.strictObject({
  kind: z.literal('threat'),
  id: threatIdSchema,
});

const mitigationSubjectSchema = z.strictObject({
  kind: z.literal('mitigation'),
  id: mitigationIdSchema,
});

const assumptionSubjectSchema = z.strictObject({
  kind: z.literal('assumption'),
  id: assumptionIdSchema,
});

/**
 * Which entity a loss entry is about. `model` names the model as a whole,
 * for a loss in metadata or in something no single record owns; every other
 * variant names one record by its id. A record the model no longer carries
 * still names itself here: on the preservation path an entry reports what a
 * source document held for an entity an edit removed.
 */
export const lossSubjectSchema = z.discriminatedUnion('kind', [
  modelSubjectSchema,
  diagramSubjectSchema,
  elementSubjectSchema,
  threatSubjectSchema,
  mitigationSubjectSchema,
  assumptionSubjectSchema,
]);

/** What a loss entry is about. */
export type LossSubject = z.infer<typeof lossSubjectSchema>;

/**
 * Why an entry's material did not come through. `unrepresentable`: the
 * format has no place for the construct. `narrowed`: the format holds a
 * reduced form of it, so less reaches the output than the model carried.
 * `split`: the format forces one record into several, as Threat Dragon
 * nests each threat under one cell, so a threat attached to several
 * elements is written once per cell and its single identity is gone.
 * `discarded-by-edit`: the write merged onto a source document, and the
 * model no longer accounts for material that document held. `undeclared`:
 * the file held a key the wire schema does not declare, so the read
 * dropped it and neither the model nor the retained document has it. The
 * first four are a write reporting on the file it produces, the last is a
 * read reporting on the file it was given.
 */
export const lossReasonSchema = z.enum([
  'unrepresentable',
  'narrowed',
  'split',
  'discarded-by-edit',
  'undeclared',
]);

/** Why an entry's material did not come through. */
export type LossReason = z.infer<typeof lossReasonSchema>;

/**
 * One loss: the entity it concerns, what did not come through, and why.
 * `dropped` is prose in the entity's own terms rather than a path into the
 * output, because only the codec knows the format's vocabulary and the two
 * write paths word the same absence differently. Nothing parses a loss
 * entry, so the non-empty bound on `dropped` records the intent rather
 * than enforcing it at any boundary.
 */
export const lossEntrySchema = z.strictObject({
  subject: lossSubjectSchema,
  dropped: z.string().min(1),
  reason: lossReasonSchema,
});

/** One entry of a loss report. */
export type LossEntry = z.infer<typeof lossEntrySchema>;

/**
 * What did not come through, in the order the codec recorded it. One type
 * serves every path: the keys a read dropped as undeclared, format-induced
 * loss where a write projects into canonical form, and edit-induced loss
 * where a write merges onto a source document. A report with no entries
 * records no loss.
 */
export const lossReportSchema = z.array(lossEntrySchema).readonly();

/** A read's or a write's loss report. */
export type LossReport = z.infer<typeof lossReportSchema>;

/**
 * The report of a read or a write that lost nothing. Frozen, so a caller
 * that treats it as a starting point cannot append to the shared value.
 */
export const emptyLossReport: LossReport = Object.freeze([]);

/** Whether the report records no loss. */
export function isLossless(report: LossReport): boolean {
  return report.length === 0;
}

const reasonPhrases: Record<LossReason, string> = {
  unrepresentable: 'no place in the format',
  narrowed: 'reduced to fit the format',
  split: 'split by the format',
  'discarded-by-edit': 'removed by an edit',
  undeclared: 'not declared by the wire schema',
};

const escapableText = /\\|\p{Cc}/gu;

const escapableId = /["\\]|\p{Cc}/gu;

/**
 * The report as lines for a person, one per entry and in the report's own
 * order. An empty report renders as a line saying so, so the rendering is
 * never blank. An id, and the `dropped` text naming what was lost, both
 * reach this rendering as the foreign file wrote them, so control
 * characters are escaped to `\uXXXX` and a backslash or a quote escapes
 * with a backslash: a newline cannot split one entry into two lines, and no
 * id can render as another. Nothing else is escaped, so
 * an id written with bidirectional or zero-width formatting still displays
 * as something other than what it says.
 */
export function renderLossReport(report: LossReport): string {
  return isLossless(report)
    ? 'No loss recorded.'
    : report.map(renderEntry).join('\n');
}

function renderEntry(entry: LossEntry): string {
  return `${renderSubject(entry.subject)}: ${escapeText(entry.dropped)} (${
    reasonPhrases[entry.reason]
  })`;
}

function renderSubject(subject: LossSubject): string {
  return subject.kind === 'model'
    ? 'model'
    : `${subject.kind} "${escapeId(subject.id)}"`;
}

function escapeText(text: string): string {
  return text.replace(escapableText, escapeCharacter);
}

function escapeId(id: string): string {
  return id.replace(escapableId, escapeCharacter);
}

function escapeCharacter(character: string): string {
  return character === '\\' || character === '"'
    ? `\\${character}`
    : `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
}
