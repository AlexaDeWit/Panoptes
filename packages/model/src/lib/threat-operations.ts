import { Either } from 'effect';
import type { ElementId, ThreatId } from './ids.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { elementIdsAcross } from './references.js';
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
 * Returns a new model with `threat` appended to the threat register and the
 * last issued number advanced to its number. The threat value comes from
 * the threat schema; what this operation checks is its fit against the
 * model. The number is the caller's to choose from those above the last
 * issued, and {@link nextThreatNumber} yields the lowest of them. Fails
 * when the id is already taken, when the number is not above the last
 * issued (a spent number stays spent, whether or not a threat still holds
 * it), or when a linked element id names no element of the model. The input
 * model is never mutated.
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
  const unlinkable = unknownElementIn(model, threat.elements);
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
 * Returns a new model without the threat named by `threatId`, cascading so
 * the rest of the model stays consistent: mitigations and assumptions lose
 * the removed threat from their `threats` links while the records
 * themselves stay. The removed threat's number stays spent: the last
 * issued number does not move, so the gap it leaves is permanent. Fails
 * when the threat is unknown. The input model is never mutated.
 */
export function removeThreat(
  model: Model,
  threatId: ThreatId,
): Either.Either<Model, RemoveThreatFailure> {
  if (!model.threats.some((threat) => threat.id === threatId)) {
    return Either.left(OperationFailure.UnknownThreat({ threatId }));
  }
  const unlinked = (ids: readonly ThreatId[]): ThreatId[] =>
    ids.filter((id) => id !== threatId);
  return Either.right({
    ...model,
    threats: model.threats.filter((threat) => threat.id !== threatId),
    mitigations: model.mitigations.map((mitigation) => ({
      ...mitigation,
      threats: unlinked(mitigation.threats),
    })),
    assumptions: model.assumptions.map((assumption) => ({
      ...assumption,
      threats: unlinked(assumption.threats),
    })),
  });
}

/**
 * Returns a new model with the threat carrying `threat.id` swapped for
 * `threat`. Editing a threat is whole-record replacement: the caller builds
 * the complete record from the threat schema and this operation checks its
 * fit against the model. Every field but the number is the caller's to
 * change. Fails when the id names no threat of the model, when the
 * replacement carries a different number from the threat it replaces, or
 * when a linked element id names no element of the model. The input model
 * is never mutated.
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
  const unlinkable = unknownElementIn(model, threat.elements);
  if (unlinkable) {
    return Either.left(
      OperationFailure.UnknownElement({ elementId: unlinkable }),
    );
  }
  return Either.right(withThreat(model, threat));
}

/**
 * Returns a new model with the element named by `elementId` linked to the
 * threat named by `threatId`. Attaching an element the threat already
 * carries succeeds and changes nothing. Fails when either id names no
 * record of the model. The input model is never mutated.
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
 * Returns a new model with the element named by `elementId` unlinked from
 * the threat named by `threatId`. Detaching an element the threat does not
 * carry succeeds and changes nothing. Fails when either id names no record
 * of the model. The input model is never mutated.
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
 * The number to give the next threat: one above the number the model last
 * issued, and 1 when it has issued none. A number a removed threat held is
 * never handed out again, so a number names one threat for the life of the
 * model.
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

function unknownElementIn(
  model: Model,
  elementIds: readonly ElementId[],
): ElementId | undefined {
  const known = elementIdsAcross(model.diagrams);
  return elementIds.find((elementId) => !known.has(elementId));
}
