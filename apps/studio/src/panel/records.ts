import {
  assumptionIdSchema,
  assumptionStatusSchema,
  generateAssumptionId,
  generateMitigationId,
  mitigationIdSchema,
  mitigationStatusSchema,
  type Assumption,
  type Mitigation,
  type Model,
  type ThreatId,
} from '@saerskriven/model';
import { Action } from '../store/actions.js';
import { distinctLabels } from './distinct-labels.js';

const recordParts = ['title', 'prose'] as const;

/** The text a record carries: a mitigation has a title and prose, an assumption prose alone. */
export type RecordPart = (typeof recordParts)[number];

/** A mitigation or an assumption, as the threat editor edits either. */
export type ThreatRecord = Mitigation | Assumption;

/** Names one text field of one record, so a refused draft typed there can be put back. */
export type RecordFieldName = `${RecordNoun}/${RecordPart}/${string}`;

type RecordNoun = 'mitigation' | 'assumption';

/**
 * What the threat editor needs to know about one kind of record: where the
 * model holds it, the text it carries, its statuses and the one it starts
 * in, and the store action for each edit.
 */
export type RecordKind<Held extends ThreatRecord> = {
  readonly noun: RecordNoun;
  readonly heading: string;
  readonly parts: readonly RecordPart[];
  readonly statuses: readonly Held['status'][];
  readonly held: (model: Model) => readonly Held[];
  readonly fresh: (threatId: ThreatId) => Held;
  readonly restored: (threatId: ThreatId, id: string) => Held | undefined;
  readonly withText: (record: Held, part: RecordPart, text: string) => Held;
  readonly add: (record: Held) => Action;
  readonly replace: (record: Held) => Action;
  readonly link: (record: Held, threatId: ThreatId) => Action;
  readonly unlink: (record: Held, threatId: ThreatId) => Action;
  readonly setStatus: (record: Held, status: Held['status']) => Action;
};

/** Mitigations, which start `proposed`. */
export const mitigationKind: RecordKind<Mitigation> = {
  noun: 'mitigation',
  heading: 'Mitigations',
  parts: ['title', 'prose'],
  statuses: mitigationStatusSchema.options,
  held: (model) => model.mitigations,
  fresh: (threatId) => ({
    id: generateMitigationId(),
    title: '',
    prose: '',
    status: 'proposed',
    threats: [threatId],
  }),
  restored: (threatId, id) => {
    const parsed = mitigationIdSchema.safeParse(id);
    return parsed.success
      ? { ...mitigationKind.fresh(threatId), id: parsed.data }
      : undefined;
  },
  withText: (record, part, text) =>
    part === 'title' ? { ...record, title: text } : { ...record, prose: text },
  add: (mitigation) => Action.AddMitigation({ mitigation }),
  replace: (mitigation) => Action.ReplaceMitigation({ mitigation }),
  link: ({ id }, threatId) =>
    Action.LinkMitigation({ mitigationId: id, threatId }),
  unlink: ({ id }, threatId) =>
    Action.UnlinkMitigation({ mitigationId: id, threatId }),
  setStatus: ({ id }, status) =>
    Action.SetMitigationStatus({ mitigationId: id, status }),
};

/** Assumptions, which start `unconfirmed` and carry prose alone. */
export const assumptionKind: RecordKind<Assumption> = {
  noun: 'assumption',
  heading: 'Assumptions',
  parts: ['prose'],
  statuses: assumptionStatusSchema.options,
  held: (model) => model.assumptions,
  fresh: (threatId) => ({
    id: generateAssumptionId(),
    prose: '',
    status: 'unconfirmed',
    threats: [threatId],
  }),
  restored: (threatId, id) => {
    const parsed = assumptionIdSchema.safeParse(id);
    return parsed.success
      ? { ...assumptionKind.fresh(threatId), id: parsed.data }
      : undefined;
  },
  withText: (record, part, text) =>
    part === 'prose' ? { ...record, prose: text } : record,
  add: (assumption) => Action.AddAssumption({ assumption }),
  replace: (assumption) => Action.ReplaceAssumption({ assumption }),
  link: ({ id }, threatId) =>
    Action.LinkAssumption({ assumptionId: id, threatId }),
  unlink: ({ id }, threatId) =>
    Action.UnlinkAssumption({ assumptionId: id, threatId }),
  setStatus: ({ id }, status) =>
    Action.SetAssumptionStatus({ assumptionId: id, status }),
};

/** The text of one part of a record. */
export function textOf(record: ThreatRecord, part: RecordPart): string {
  return part === 'title'
    ? 'title' in record
      ? record.title
      : ''
    : record.prose;
}

/** The records of one kind linked to the threat, in register order. */
export function recordsOn<Held extends ThreatRecord>(
  records: readonly Held[],
  threatId: ThreatId,
): readonly Held[] {
  return records.filter((record) => record.threats.includes(threatId));
}

/** How many threats other than this one the record is linked to. */
export function otherThreats(record: ThreatRecord, threatId: ThreatId): number {
  return record.threats.filter((id) => id !== threatId).length;
}

/**
 * The records of one kind that "Link existing" offers the threat: every one
 * not already linked to it, each under a label a person can tell apart.
 */
export function linkableRecords<Held extends ThreatRecord>(
  records: readonly Held[],
  threatId: ThreatId,
): readonly { readonly record: Held; readonly label: string }[] {
  const offered = records.filter(
    (record) => !record.threats.includes(threatId),
  );
  const labels = distinctLabels(
    offered.map((record) => {
      const named = [textOf(record, 'title'), record.prose]
        .map((text) => text.split('\n')[0].trim())
        .find((line) => line !== '');
      return {
        id: record.id,
        label: named ?? record.id,
        unnamed: named === undefined,
      };
    }),
  );
  return offered.map((record) => ({
    record,
    label: labels.get(record.id) ?? record.id,
  }));
}

/**
 * The record `text` makes of one part of `record`, and nothing where the
 * part already holds that text, so an edit nobody made dispatches nothing.
 */
export function editedRecord<Held extends ThreatRecord>(
  kind: RecordKind<Held>,
  record: Held,
  part: RecordPart,
  text: string,
): Held | undefined {
  return textOf(record, part) === text
    ? undefined
    : kind.withText(record, part, text);
}

/** The name a refused draft in one part of one record is held under. */
export function recordFieldName(
  noun: RecordNoun,
  part: RecordPart,
  recordId: string,
): RecordFieldName {
  return `${noun}/${part}/${recordId}`;
}

/** Whether a held field name names a text field of a record of this kind. */
export function isRecordField(
  field: string,
  noun: RecordNoun,
): field is RecordFieldName {
  return recordIdIn(field, noun) !== undefined;
}

/** The id of the record a held field name belongs to, where it names a record of this kind. */
export function recordIdIn(
  field: string | undefined,
  noun: RecordNoun,
): string | undefined {
  const prefix = recordParts
    .map((part) => `${noun}/${part}/`)
    .find((candidate) => field?.startsWith(candidate) === true);
  return prefix === undefined ? undefined : field?.slice(prefix.length);
}
