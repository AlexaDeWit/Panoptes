import { Either } from 'effect';
import type { ElementId, ThreatId } from './ids.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { culledAfter } from './records.js';
import { elementIdsAcross, unknownElementIn } from './references.js';
import type { Threat } from './threats.js';

/** The failures {@link addThreat} can produce. */
export type AddThreatFailure = Extract<
  OperationFailure,
  { _tag: 'DuplicateThreatId' | 'ReusedThreatNumber' | 'UnknownElement' }
>;

/** The failure {@link removeThreat} can produce. */
export type RemoveThreatFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownThreat' }
>;

/** The failures {@link replaceThreat} can produce. */
export type ReplaceThreatFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownThreat' | 'ChangedThreatNumber' | 'UnknownElement' }
>;

type ThreatLinkFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownThreat' | 'UnknownElement' }
>;

/** The failures {@link attachThreat} can produce. */
export type AttachThreatFailure = ThreatLinkFailure;

/** The failures {@link detachThreat} can produce. */
export type DetachThreatFailure = ThreatLinkFailure;

/**
 * Appends `threat` to the register and advances the last issued number to
 * its number, which must be above the last issued ({@link nextThreatNumber}
 * yields the lowest such number). Fails on a taken id, a spent number, or a
 * link to an element the model does not hold.
 */
export function addThreat(
  model: Model,
  threat: Threat,
): Either.Either<Model, AddThreatFailure> {
  if (model.threats.some((candidate) => candidate.id === threat.id)) {
    return Either.left(
      OperationFailure.DuplicateThreatId({ threatId: threat.id }),
    );
  }
  if (threat.number <= model.lastIssuedThreatNumber) {
    return Either.left(
      OperationFailure.ReusedThreatNumber({ number: threat.number }),
    );
  }
  const unlinkable = unknownElementIn(model.diagrams, threat.elements);
  if (unlinkable) {
    return Either.left(
      OperationFailure.UnknownElement({ elementId: unlinkable }),
    );
  }
  return Either.right({
    ...model,
    threats: [...model.threats, threat],
    lastIssuedThreatNumber: threat.number,
  });
}

/**
 * Returns a new model without the threat named by `threatId`. Every
 * mitigation and assumption loses its link to it, and a record whose only
 * threat link it was goes with it. The removed threat's number stays spent,
 * so the gap it leaves is permanent. Fails when the threat is unknown.
 */
export function removeThreat(
  model: Model,
  threatId: ThreatId,
): Either.Either<Model, RemoveThreatFailure> {
  if (!model.threats.some((threat) => threat.id === threatId)) {
    return Either.left(OperationFailure.UnknownThreat({ threatId }));
  }
  const unlinked = <Linked extends { readonly threats: ThreatId[] }>(
    record: Linked,
  ): Linked => ({
    ...record,
    threats: record.threats.filter((id) => id !== threatId),
  });
  return Either.right({
    ...model,
    threats: model.threats.filter((threat) => threat.id !== threatId),
    mitigations: culledAfter(model.mitigations, unlinked),
    assumptions: culledAfter(model.assumptions, unlinked),
  });
}

/**
 * Swaps the threat carrying `threat.id` for `threat` in place. Every field
 * but the id and the number is the caller's to change. Fails on an unknown
 * threat, a changed number, or a link to an element the model does not
 * hold.
 */
export function replaceThreat(
  model: Model,
  threat: Threat,
): Either.Either<Model, ReplaceThreatFailure> {
  const replaced = model.threats.find(
    (candidate) => candidate.id === threat.id,
  );
  if (!replaced) {
    return Either.left(OperationFailure.UnknownThreat({ threatId: threat.id }));
  }
  if (replaced.number !== threat.number) {
    return Either.left(
      OperationFailure.ChangedThreatNumber({
        threatId: threat.id,
        number: threat.number,
      }),
    );
  }
  const unlinkable = unknownElementIn(model.diagrams, threat.elements);
  if (unlinkable) {
    return Either.left(
      OperationFailure.UnknownElement({ elementId: unlinkable }),
    );
  }
  return Either.right(withThreat(model, threat));
}

/**
 * Links the element to the threat. Attaching an element the threat already
 * carries changes nothing. Fails when either id names nothing.
 */
export function attachThreat(
  model: Model,
  threatId: ThreatId,
  elementId: ElementId,
): Either.Either<Model, AttachThreatFailure> {
  return withRelinkedThreat(model, threatId, elementId, (elements) =>
    elements.includes(elementId) ? [...elements] : [...elements, elementId],
  );
}

/**
 * Unlinks the element from the threat. Detaching an element the threat does
 * not carry changes nothing. Fails when either id names nothing.
 */
export function detachThreat(
  model: Model,
  threatId: ThreatId,
  elementId: ElementId,
): Either.Either<Model, DetachThreatFailure> {
  return withRelinkedThreat(model, threatId, elementId, (elements) =>
    elements.filter((id) => id !== elementId),
  );
}

/**
 * One above the number the model last issued, so a removed threat's number
 * is never handed out again.
 */
export function nextThreatNumber(model: Model): number {
  return model.lastIssuedThreatNumber + 1;
}

function withThreat(model: Model, next: Threat): Model {
  return {
    ...model,
    threats: model.threats.map((threat) =>
      threat.id === next.id ? next : threat,
    ),
  };
}

function withRelinkedThreat(
  model: Model,
  threatId: ThreatId,
  elementId: ElementId,
  relink: (elements: readonly ElementId[]) => ElementId[],
): Either.Either<Model, ThreatLinkFailure> {
  const threat = model.threats.find((candidate) => candidate.id === threatId);
  if (!threat) {
    return Either.left(OperationFailure.UnknownThreat({ threatId }));
  }
  if (!elementIdsAcross(model.diagrams).has(elementId)) {
    return Either.left(OperationFailure.UnknownElement({ elementId }));
  }
  return Either.right(
    withThreat(model, { ...threat, elements: relink(threat.elements) }),
  );
}
