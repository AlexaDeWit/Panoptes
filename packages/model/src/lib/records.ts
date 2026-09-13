import { Either } from 'effect';
import { z } from 'zod';
import {
  assumptionIdSchema,
  mitigationIdSchema,
  type ThreatId,
} from './ids.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';

/** Names one record across both registers, where a mitigation and an assumption may share an id. */
export const recordReferenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('mitigation'), id: mitigationIdSchema }),
  z.object({ kind: z.literal('assumption'), id: assumptionIdSchema }),
]);

/** A mitigation or an assumption, by kind and id. */
export type RecordReference = z.infer<typeof recordReferenceSchema>;

type ThreatLinked = {
  readonly id: string;
  readonly threats: readonly string[];
};

type RecordKey = 'mitigations' | 'assumptions';

type RecordIn<Key extends RecordKey> = Model[Key][number];

type UnknownThreatFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownThreat' }
>;

/** The register a per-kind record operation edits, and its failure for an id the register does not hold. */
export type RecordRegister<Key extends RecordKey, Unknown> = {
  readonly key: Key;
  readonly unknown: (id: RecordIn<Key>['id']) => Unknown;
};

/**
 * Applies `relink` to the threat links of one record, culling the record
 * where that leaves it no link. A relink that changes no link returns the
 * model it was given.
 */
export function relinkedRecord<Key extends RecordKey, Unknown>(
  model: Model,
  register: RecordRegister<Key, Unknown>,
  recordId: RecordIn<Key>['id'],
  threatId: ThreatId,
  relink: (threats: readonly ThreatId[]) => ThreatId[],
): Either.Either<Model, Unknown | UnknownThreatFailure> {
  const records: readonly RecordIn<Key>[] = model[register.key];
  const held = records.find(({ id }) => id === recordId);
  if (!held) {
    return Either.left(register.unknown(recordId));
  }
  if (!model.threats.some(({ id }) => id === threatId)) {
    return Either.left(OperationFailure.UnknownThreat({ threatId }));
  }
  const threats = relink(held.threats);
  return threats.length === held.threats.length
    ? Either.right(model)
    : Either.right({
        ...model,
        [register.key]: culledAfter(records, (candidate) =>
          candidate.id === recordId ? { ...held, threats } : candidate,
        ),
      });
}

/** Sets one record's status. The status it already has returns the model it was given. */
export function withRecordStatus<Key extends RecordKey, Unknown>(
  model: Model,
  register: RecordRegister<Key, Unknown>,
  recordId: RecordIn<Key>['id'],
  status: RecordIn<Key>['status'],
): Either.Either<Model, Unknown> {
  const records: readonly RecordIn<Key>[] = model[register.key];
  const held = records.find(({ id }) => id === recordId);
  if (!held) {
    return Either.left(register.unknown(recordId));
  }
  return held.status === status
    ? Either.right(model)
    : Either.right({
        ...model,
        [register.key]: records.map((candidate) =>
          candidate.id === recordId ? { ...held, status } : candidate,
        ),
      });
}

/**
 * `records` with `edit` applied to each one, less every record the edit
 * takes from one or more threat links to none. A record that had no link
 * before the edit stays.
 */
export function culledAfter<Linked extends ThreatLinked>(
  records: readonly Linked[],
  edit: (record: Linked) => Linked,
): Linked[] {
  return records.flatMap((record) => {
    const next = edit(record);
    return record.threats.length > 0 && next.threats.length === 0 ? [] : [next];
  });
}

/** `threats` with `threatId` appended, unless it already names it. */
export function linkedThreats(
  threats: readonly ThreatId[],
  threatId: ThreatId,
): ThreatId[] {
  return threats.includes(threatId) ? [...threats] : [...threats, threatId];
}

/**
 * The records `before` holds and `after` does not, mitigations first, each
 * in register order.
 */
export function droppedRecords(before: Model, after: Model): RecordReference[] {
  const heldMitigations = new Set(after.mitigations.map(({ id }) => id));
  const heldAssumptions = new Set(after.assumptions.map(({ id }) => id));
  return [
    ...before.mitigations
      .filter(({ id }) => !heldMitigations.has(id))
      .map(({ id }): RecordReference => ({ kind: 'mitigation', id })),
    ...before.assumptions
      .filter(({ id }) => !heldAssumptions.has(id))
      .map(({ id }): RecordReference => ({ kind: 'assumption', id })),
  ];
}
