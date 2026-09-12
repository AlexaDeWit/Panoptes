import { z } from 'zod';
import {
  assumptionIdSchema,
  mitigationIdSchema,
  type ThreatId,
} from './ids.js';
import type { Model } from './parse.js';

/** One mitigation or assumption record, named by its kind and its id. */
export const recordReferenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('mitigation'), id: mitigationIdSchema }),
  z.object({ kind: z.literal('assumption'), id: assumptionIdSchema }),
]);

/** A mitigation or assumption record, named by its kind and its id. */
export type RecordReference = z.infer<typeof recordReferenceSchema>;

type ThreatLinked = {
  readonly id: string;
  readonly threats: readonly string[];
};

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
