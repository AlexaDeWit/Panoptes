import { Either } from 'effect';
import type { ElementId, ThreatId } from './ids.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { elementIdsAcross, threatIdsOf } from './references.js';
import type { Threat } from './threats.js';

/** The failures {@link addThreat} can produce. */
export type AddThreatFailure = Extract<
  OperationFailure,
  { _tag: 'DuplicateThreatId' | 'DuplicateThreatNumber' | 'UnknownElement' }
>;

/** The failure {@link removeThreat} can produce. */
export type RemoveThreatFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownThreat' }
>;

/** The failures {@link replaceThreat} can produce. */
export type ReplaceThreatFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownThreat' | 'DuplicateThreatNumber' | 'UnknownElement' }
>;

/** The failures {@link attachThreat} can produce. */
export type AttachThreatFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownThreat' | 'UnknownElement' }
>;

/** The failures {@link detachThreat} can produce. */
export type DetachThreatFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownThreat' | 'UnknownElement' }
>;

/**
 * Returns a new model with `threat` appended to the threat register. The
 * threat value comes from the threat schema; what this operation checks is
 * its fit against the model. Numbers are the caller's to choose, and
 * {@link nextThreatNumber} yields a free one. Fails when the id or the
 * number is already taken, or when a linked element id names no element of
 * the model. The input model is never mutated.
 */
export function addThreat(
  model: Model,
  threat: Threat,
): Either.Either<Model, AddThreatFailure> {
  if (threatIdsOf(model.threats).has(threat.id)) {
    return Either.left(
      OperationFailure.DuplicateThreatId({ threatId: threat.id }),
    );
  }
  if (model.threats.some((candidate) => candidate.number === threat.number)) {
    return Either.left(
      OperationFailure.DuplicateThreatNumber({ number: threat.number }),
    );
  }
  const unlinkable = unknownElementIn(model, threat.elements);
  if (unlinkable) {
    return Either.left(
      OperationFailure.UnknownElement({ elementId: unlinkable }),
    );
  }
  return Either.right({ ...model, threats: [...model.threats, threat] });
}

/**
 * Returns a new model without the threat named by `threatId`, cascading so
 * the rest of the model stays consistent: mitigations and assumptions lose
 * the removed threat from their `threats` links while the records
 * themselves stay. Threat numbers are left alone, so removing opens a gap
 * until {@link renumberThreats} closes it. Fails when the threat is
 * unknown. The input model is never mutated.
 */
export function removeThreat(
  model: Model,
  threatId: ThreatId,
): Either.Either<Model, RemoveThreatFailure> {
  if (!threatIdsOf(model.threats).has(threatId)) {
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
 * fit against the model. Fails when the id names no threat of the model,
 * when the number belongs to a different threat, or when a linked element
 * id names no element of the model. The input model is never mutated.
 */
export function replaceThreat(
  model: Model,
  threat: Threat,
): Either.Either<Model, ReplaceThreatFailure> {
  if (!threatIdsOf(model.threats).has(threat.id)) {
    return Either.left(OperationFailure.UnknownThreat({ threatId: threat.id }));
  }
  const numberTaken = model.threats.some(
    (candidate) =>
      candidate.number === threat.number && candidate.id !== threat.id,
  );
  if (numberTaken) {
    return Either.left(
      OperationFailure.DuplicateThreatNumber({ number: threat.number }),
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
 * Returns a new model whose threats carry the numbers 1 to n: each threat
 * takes the rank its current number holds in ascending order, so relative
 * order survives and gaps close. The threat array keeps its own order.
 * Applying this to its own output changes nothing. The input model is never
 * mutated.
 */
export function renumberThreats(model: Model): Model {
  const rank = (number: number): number =>
    model.threats.filter((threat) => threat.number < number).length + 1;
  return {
    ...model,
    threats: model.threats.map((threat) => ({
      ...threat,
      number: rank(threat.number),
    })),
  };
}

/**
 * A threat number no threat of the model holds: one above the highest in
 * use, and 1 when the register is empty. A number a removed threat once
 * held is not handed out again, so a number names one threat for as long as
 * the model goes unrenumbered.
 */
export function nextThreatNumber(model: Model): number {
  return Math.max(0, ...model.threats.map((threat) => threat.number)) + 1;
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
): Either.Either<Model, AttachThreatFailure> {
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
