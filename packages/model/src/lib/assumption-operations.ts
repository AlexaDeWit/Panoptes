import { Either } from 'effect';
import type { Assumption, AssumptionStatus } from './assumptions.js';
import type { AssumptionId, ThreatId } from './ids.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { culledAfter, linkedThreats } from './records.js';
import { unknownElementIn, unknownThreatIn } from './references.js';

type UnknownAssumptionFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownAssumption' }
>;

type AssumptionReferenceFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' | 'UnknownThreat' }
>;

/** The failures {@link addAssumption} can produce. */
export type AddAssumptionFailure =
  | Extract<
      OperationFailure,
      { _tag: 'DuplicateAssumptionId' | 'RecordWithoutThreat' }
    >
  | AssumptionReferenceFailure;

/** The failures {@link replaceAssumption} can produce. */
export type ReplaceAssumptionFailure =
  | UnknownAssumptionFailure
  | AssumptionReferenceFailure;

/** The failure {@link removeAssumption} can produce. */
export type RemoveAssumptionFailure = UnknownAssumptionFailure;

/** The failures {@link linkAssumption} and {@link unlinkAssumption} can produce. */
export type AssumptionLinkFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownAssumption' | 'UnknownThreat' }
>;

/** The failure {@link setAssumptionStatus} can produce. */
export type SetAssumptionStatusFailure = UnknownAssumptionFailure;

/**
 * Appends `assumption` to the register. Refuses a taken id, an assumption
 * linked to no threat, and a link to an element or threat the model does
 * not hold.
 */
export function addAssumption(
  model: Model,
  assumption: Assumption,
): Either.Either<Model, AddAssumptionFailure> {
  if (model.assumptions.some((candidate) => candidate.id === assumption.id)) {
    return Either.left(
      OperationFailure.DuplicateAssumptionId({ assumptionId: assumption.id }),
    );
  }
  if (assumption.threats.length === 0) {
    return Either.left(
      OperationFailure.RecordWithoutThreat({
        record: { kind: 'assumption', id: assumption.id },
      }),
    );
  }
  const unlinkable = referenceFailure(model, assumption);
  return unlinkable
    ? Either.left(unlinkable)
    : Either.right({
        ...model,
        assumptions: [...model.assumptions, assumption],
      });
}

/**
 * Swaps the assumption carrying `assumption.id` for `assumption` in place.
 * A replacement that takes the assumption from one or more threat links to
 * none removes it instead, whatever element links it keeps. One that
 * already had no threat link stays.
 */
export function replaceAssumption(
  model: Model,
  assumption: Assumption,
): Either.Either<Model, ReplaceAssumptionFailure> {
  if (!model.assumptions.some((candidate) => candidate.id === assumption.id)) {
    return Either.left(
      OperationFailure.UnknownAssumption({ assumptionId: assumption.id }),
    );
  }
  const unlinkable = referenceFailure(model, assumption);
  return unlinkable
    ? Either.left(unlinkable)
    : Either.right({
        ...model,
        assumptions: culledAfter(model.assumptions, (candidate) =>
          candidate.id === assumption.id ? assumption : candidate,
        ),
      });
}

/**
 * Drops the assumption named by `assumptionId`. This is an explicit
 * removal, not a cull, and the elements and threats it rested on are
 * untouched.
 */
export function removeAssumption(
  model: Model,
  assumptionId: AssumptionId,
): Either.Either<Model, RemoveAssumptionFailure> {
  if (!model.assumptions.some((candidate) => candidate.id === assumptionId)) {
    return Either.left(OperationFailure.UnknownAssumption({ assumptionId }));
  }
  return Either.right({
    ...model,
    assumptions: model.assumptions.filter(
      (candidate) => candidate.id !== assumptionId,
    ),
  });
}

/**
 * Links the assumption to the threat. A link the assumption already holds
 * returns the model it was given.
 */
export function linkAssumption(
  model: Model,
  assumptionId: AssumptionId,
  threatId: ThreatId,
): Either.Either<Model, AssumptionLinkFailure> {
  return withRelinkedAssumption(model, assumptionId, threatId, (threats) =>
    linkedThreats(threats, threatId),
  );
}

/**
 * Unlinks the assumption from the threat, removing the assumption where
 * that was its last threat link, whatever element links it keeps. A link
 * the assumption does not hold returns the model it was given.
 */
export function unlinkAssumption(
  model: Model,
  assumptionId: AssumptionId,
  threatId: ThreatId,
): Either.Either<Model, AssumptionLinkFailure> {
  return withRelinkedAssumption(model, assumptionId, threatId, (threats) =>
    threats.filter((id) => id !== threatId),
  );
}

/**
 * Sets the status of one assumption, and nothing else. The status it
 * already has returns the model it was given.
 */
export function setAssumptionStatus(
  model: Model,
  assumptionId: AssumptionId,
  status: AssumptionStatus,
): Either.Either<Model, SetAssumptionStatusFailure> {
  const held = model.assumptions.find(({ id }) => id === assumptionId);
  if (!held) {
    return Either.left(OperationFailure.UnknownAssumption({ assumptionId }));
  }
  return held.status === status
    ? Either.right(model)
    : Either.right({
        ...model,
        assumptions: model.assumptions.map((candidate) =>
          candidate.id === assumptionId ? { ...held, status } : candidate,
        ),
      });
}

function withRelinkedAssumption(
  model: Model,
  assumptionId: AssumptionId,
  threatId: ThreatId,
  relink: (threats: readonly ThreatId[]) => ThreatId[],
): Either.Either<Model, AssumptionLinkFailure> {
  const held = model.assumptions.find(({ id }) => id === assumptionId);
  if (!held) {
    return Either.left(OperationFailure.UnknownAssumption({ assumptionId }));
  }
  if (!model.threats.some(({ id }) => id === threatId)) {
    return Either.left(OperationFailure.UnknownThreat({ threatId }));
  }
  const threats = relink(held.threats);
  return threats.length === held.threats.length
    ? Either.right(model)
    : Either.right({
        ...model,
        assumptions: culledAfter(model.assumptions, (candidate) =>
          candidate.id === assumptionId ? { ...held, threats } : candidate,
        ),
      });
}

function referenceFailure(
  model: Model,
  assumption: Assumption,
): AssumptionReferenceFailure | undefined {
  const element = unknownElementIn(model.diagrams, assumption.elements);
  if (element) {
    return OperationFailure.UnknownElement({ elementId: element });
  }
  const threat = unknownThreatIn(model.threats, assumption.threats);
  return threat
    ? OperationFailure.UnknownThreat({ threatId: threat })
    : undefined;
}
