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
 * Which entity a divergence is about. `model` names the model as a whole,
 * for a divergence in metadata or in something no single record owns; every
 * other variant names one record by its id. A record the model no longer
 * carries still names itself here: on the preservation path an entry
 * reports what a source document held for an entity an edit removed.
 */
export const divergenceSubjectSchema = z.discriminatedUnion('kind', [
  modelSubjectSchema,
  diagramSubjectSchema,
  elementSubjectSchema,
  threatSubjectSchema,
  mitigationSubjectSchema,
  assumptionSubjectSchema,
]);

/** What a divergence is about. */
export type DivergenceSubject = z.infer<typeof divergenceSubjectSchema>;

/**
 * Why the file and the model do not correspond. `unrepresentable`: the
 * model held something the format cannot express. `undeclared`: the file
 * held something the wire schema does not declare, so the read dropped it
 * and neither the model nor the retained document has it. `narrowed`: a
 * value was reduced to fit what the format holds. `split`: one record
 * became several, as Threat Dragon nests each threat under one cell, so a
 * threat attached to several elements is written once per cell and its
 * single identity is gone. `overridden`: the codec wrote a value the source
 * disagreed with, not because the source value was too much to carry but
 * because the codec will not repeat a claim it cannot stand behind, as a
 * write stamping the format release it produces over the one the file
 * arrived with. `discarded-by-edit`: an edit removed something the source
 * document had, so the merge did not carry it forward. All but
 * `undeclared` are a write reporting on the file it produced, and
 * `undeclared` is a read reporting on the file it was given.
 */
export const divergenceReasonSchema = z.enum([
  'unrepresentable',
  'undeclared',
  'narrowed',
  'split',
  'overridden',
  'discarded-by-edit',
]);

/** Why the file and the model do not correspond. */
export type DivergenceReason = z.infer<typeof divergenceReasonSchema>;

/**
 * One divergence: the entity it concerns, what did not correspond, and why.
 * `detail` is prose in the entity's own terms rather than a path into the
 * file, because only the codec knows the format's vocabulary, and the read
 * and write paths word the same divergence differently. Nothing parses a
 * divergence, so the non-empty bound on `detail` records the intent rather
 * than enforcing it at any boundary.
 */
export const divergenceSchema = z.strictObject({
  subject: divergenceSubjectSchema,
  detail: z.string().min(1),
  reason: divergenceReasonSchema,
});

/**
 * One place a file and the model do not correspond exactly. A read or a
 * write returns these in the order it recorded them, and an empty list is
 * the aligned case, where the file and the model say the same thing.
 */
export type Divergence = z.infer<typeof divergenceSchema>;

/**
 * The aligned case, for a read or a write with nothing to report. Frozen,
 * so a caller that treats it as a starting point cannot append to the
 * shared value.
 */
export const noDivergence: readonly Divergence[] = Object.freeze([]);

/** Whether anything diverged. */
export function hasDiverged(divergences: readonly Divergence[]): boolean {
  return divergences.length > 0;
}

const reasonPhrases: Record<DivergenceReason, string> = {
  unrepresentable: 'no place in the format',
  undeclared: 'not declared by the wire schema',
  narrowed: 'reduced to fit the format',
  split: 'split by the format',
  overridden: 'not repeated by the codec',
  'discarded-by-edit': 'removed by an edit',
};

const escapableText = /\\|\p{Cc}/gu;

const escapableId = /["\\]|\p{Cc}/gu;

/**
 * The divergences as lines for a person, one per entry and in the order the
 * codec recorded them. An empty list renders as a line saying so, so the
 * rendering is never blank. An id reaches this rendering as the foreign
 * file wrote it and `detail` can quote what the file said, so both are
 * escaped: control characters to `\uXXXX`, and a backslash or a quote with
 * a backslash. A newline cannot split one entry into two lines, and no id
 * can render as another. Nothing else is escaped, so an id written with
 * bidirectional or zero-width formatting still displays as something other
 * than what it says.
 */
export function renderDivergences(divergences: readonly Divergence[]): string {
  return hasDiverged(divergences)
    ? divergences.map(renderDivergence).join('\n')
    : 'No divergence recorded.';
}

function renderDivergence(divergence: Divergence): string {
  return `${renderSubject(divergence.subject)}: ${escapeText(
    divergence.detail,
  )} (${reasonPhrases[divergence.reason]})`;
}

function renderSubject(subject: DivergenceSubject): string {
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
