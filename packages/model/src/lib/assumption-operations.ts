import { Either } from 'effect';
import type { Assumption } from './assumptions.js';
import type { AssumptionId } from './ids.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { unknownElementIn, unknownThreatIn } from './references.js';

type AssumptionLinkFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' | 'UnknownThreat' }
>;

/** The failures {@link addAssumption} can produce. */
export type AddAssumptionFailure =
  | Extract<OperationFailure, { _tag: 'DuplicateAssumptionId' }>
  | AssumptionLinkFailure;

/** The failures {@link replaceAssumption} can produce. */
export type ReplaceAssumptionFailure =
  | Extract<OperationFailure, { _tag: 'UnknownAssumption' }>
  | AssumptionLinkFailure;

/** The failure {@link removeAssumption} can produce. */
export type RemoveAssumptionFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownAssumption' }
>;

/**
 * Returns a new model with `assumption` appended to the register. The
 * assumption value comes from the assumption schema; what this operation
 * checks is its fit against the model. Fails when the id is already taken,
 * when a linked element id names no element of the model, or when a linked
 * threat id names no threat of it. The input model is never mutated.
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
  const unlinkable = linkFailure(model, assumption);
  return unlinkable
    ? Either.left(unlinkable)
    : Either.right({
        ...model,
        assumptions: [...model.assumptions, assumption],
      });
}

/**
 * Returns a new model with the assumption carrying `assumption.id` swapped
 * for `assumption`, keeping its place in the register. Editing an
 * assumption is whole-record replacement, as editing a threat is: every
 * field but the id is the caller's to change, its status included, so
 * invalidating an assumption goes through here. Fails when the id names no
 * assumption of the model or when a linked element or threat id resolves to
 * nothing. The input model is never mutated.
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
  const unlinkable = linkFailure(model, assumption);
  return unlinkable
    ? Either.left(unlinkable)
    : Either.right({
        ...model,
        assumptions: model.assumptions.map((candidate) =>
          candidate.id === assumption.id ? assumption : candidate,
        ),
      });
}

/**
 * Returns a new model without the assumption named by `assumptionId`. The
 * elements and threats it rested on keep their own records and lose
 * nothing: neither carries a link back, so the links leave with the
 * assumption that held them. Fails when the assumption is unknown. The
 * input model is never mutated.
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

function linkFailure(
  model: Model,
  assumption: Assumption,
): AssumptionLinkFailure | undefined {
  const element = unknownElementIn(model.diagrams, assumption.elements);
  if (element) {
    return OperationFailure.UnknownElement({ elementId: element });
  }
  const threat = unknownThreatIn(model.threats, assumption.threats);
  return threat
    ? OperationFailure.UnknownThreat({ threatId: threat })
    : undefined;
}
