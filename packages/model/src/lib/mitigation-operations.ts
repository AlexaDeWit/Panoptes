import { Either } from 'effect';
import type { MitigationId, ThreatId } from './ids.js';
import type { Mitigation, MitigationStatus } from './mitigations.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import {
  culledAfter,
  linkedThreats,
  relinkedRecord,
  withRecordStatus,
  type RecordRegister,
} from './records.js';
import { unknownThreatIn } from './references.js';

type UnknownMitigationFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownMitigation' }
>;

const mitigations: RecordRegister<'mitigations', UnknownMitigationFailure> = {
  key: 'mitigations',
  unknown: (mitigationId) =>
    OperationFailure.UnknownMitigation({ mitigationId }),
};

/** The failures {@link addMitigation} can produce. */
export type AddMitigationFailure = Extract<
  OperationFailure,
  { _tag: 'DuplicateMitigationId' | 'RecordWithoutThreat' | 'UnknownThreat' }
>;

/** The failures {@link replaceMitigation} can produce. */
export type ReplaceMitigationFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownMitigation' | 'UnknownThreat' }
>;

/** The failure {@link removeMitigation} can produce. */
export type RemoveMitigationFailure = UnknownMitigationFailure;

/** The failures {@link linkMitigation} and {@link unlinkMitigation} can produce. */
export type MitigationLinkFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownMitigation' | 'UnknownThreat' }
>;

/** The failure {@link setMitigationStatus} can produce. */
export type SetMitigationStatusFailure = UnknownMitigationFailure;

/**
 * Appends `mitigation` to the register. Refuses a taken id, a mitigation
 * linked to no threat, and a link to a threat the model does not hold.
 */
export function addMitigation(
  model: Model,
  mitigation: Mitigation,
): Either.Either<Model, AddMitigationFailure> {
  if (model.mitigations.some((candidate) => candidate.id === mitigation.id)) {
    return Either.left(
      OperationFailure.DuplicateMitigationId({ mitigationId: mitigation.id }),
    );
  }
  if (mitigation.threats.length === 0) {
    return Either.left(
      OperationFailure.RecordWithoutThreat({
        record: { kind: 'mitigation', id: mitigation.id },
      }),
    );
  }
  const unlinkable = unknownThreatIn(model.threats, mitigation.threats);
  if (unlinkable) {
    return Either.left(
      OperationFailure.UnknownThreat({ threatId: unlinkable }),
    );
  }
  return Either.right({
    ...model,
    mitigations: [...model.mitigations, mitigation],
  });
}

/**
 * Swaps the mitigation carrying `mitigation.id` for `mitigation` in place.
 * A replacement that takes the mitigation from one or more threat links to
 * none removes it instead. One that already had no link stays.
 */
export function replaceMitigation(
  model: Model,
  mitigation: Mitigation,
): Either.Either<Model, ReplaceMitigationFailure> {
  if (!model.mitigations.some((candidate) => candidate.id === mitigation.id)) {
    return Either.left(
      OperationFailure.UnknownMitigation({ mitigationId: mitigation.id }),
    );
  }
  const unlinkable = unknownThreatIn(model.threats, mitigation.threats);
  if (unlinkable) {
    return Either.left(
      OperationFailure.UnknownThreat({ threatId: unlinkable }),
    );
  }
  return Either.right({
    ...model,
    mitigations: culledAfter(model.mitigations, (candidate) =>
      candidate.id === mitigation.id ? mitigation : candidate,
    ),
  });
}

/**
 * Drops the mitigation named by `mitigationId`. This is an explicit
 * removal, not a cull, and the threats it addressed are untouched.
 */
export function removeMitigation(
  model: Model,
  mitigationId: MitigationId,
): Either.Either<Model, RemoveMitigationFailure> {
  if (!model.mitigations.some((candidate) => candidate.id === mitigationId)) {
    return Either.left(OperationFailure.UnknownMitigation({ mitigationId }));
  }
  return Either.right({
    ...model,
    mitigations: model.mitigations.filter(
      (candidate) => candidate.id !== mitigationId,
    ),
  });
}

/**
 * Links the mitigation to the threat. A link the mitigation already holds
 * returns the model it was given.
 */
export function linkMitigation(
  model: Model,
  mitigationId: MitigationId,
  threatId: ThreatId,
): Either.Either<Model, MitigationLinkFailure> {
  return relinkedRecord(model, mitigations, mitigationId, threatId, (threats) =>
    linkedThreats(threats, threatId),
  );
}

/**
 * Unlinks the mitigation from the threat, removing the mitigation where
 * that was its last link. A link the mitigation does not hold returns the
 * model it was given.
 */
export function unlinkMitigation(
  model: Model,
  mitigationId: MitigationId,
  threatId: ThreatId,
): Either.Either<Model, MitigationLinkFailure> {
  return relinkedRecord(model, mitigations, mitigationId, threatId, (threats) =>
    threats.filter((id) => id !== threatId),
  );
}

/**
 * Sets the status of one mitigation, and nothing else. The status it
 * already has returns the model it was given.
 */
export function setMitigationStatus(
  model: Model,
  mitigationId: MitigationId,
  status: MitigationStatus,
): Either.Either<Model, SetMitigationStatusFailure> {
  return withRecordStatus(model, mitigations, mitigationId, status);
}
