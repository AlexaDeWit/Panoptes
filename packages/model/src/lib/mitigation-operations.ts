import { Either } from 'effect';
import type { MitigationId } from './ids.js';
import type { Mitigation } from './mitigations.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { unknownThreatIn } from './references.js';

/** The failures {@link addMitigation} can produce. */
export type AddMitigationFailure = Extract<
  OperationFailure,
  { _tag: 'DuplicateMitigationId' | 'UnknownThreat' }
>;

/** The failures {@link replaceMitigation} can produce. */
export type ReplaceMitigationFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownMitigation' | 'UnknownThreat' }
>;

/** The failure {@link removeMitigation} can produce. */
export type RemoveMitigationFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownMitigation' }
>;

/**
 * Returns a new model with `mitigation` appended to the register. The
 * mitigation value comes from the mitigation schema; what this operation
 * checks is its fit against the model. Fails when the id is already taken
 * or when a linked threat id names no threat of the model. The input model
 * is never mutated.
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
 * Returns a new model with the mitigation carrying `mitigation.id` swapped
 * for `mitigation`, keeping its place in the register. Editing a mitigation
 * is whole-record replacement, as editing a threat is: every field but the
 * id is the caller's to change. Fails when the id names no mitigation of
 * the model or when a linked threat id names no threat of it. The input
 * model is never mutated.
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
    mitigations: model.mitigations.map((candidate) =>
      candidate.id === mitigation.id ? mitigation : candidate,
    ),
  });
}

/**
 * Returns a new model without the mitigation named by `mitigationId`. The
 * threats it addressed keep their own records and lose nothing: a threat
 * carries no link back, so the links leave with the mitigation that held
 * them. Fails when the mitigation is unknown. The input model is never
 * mutated.
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
