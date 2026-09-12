import { Either } from 'effect';
import type { ModelMetadata, ModelMetadataChange } from './model.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { firstRefusedCharacter } from './text.js';

/** The failures {@link setModelMetadata} can produce. */
export type SetModelMetadataFailure = Extract<
  OperationFailure,
  { _tag: 'RefusedMetadataCharacter' | 'RefusedContributorCharacter' }
>;

/**
 * Replaces the metadata fields `change` names and keeps the others, returning
 * the same model where nothing differs. Empty text is valid in every field.
 */
export function setModelMetadata(
  model: Model,
  change: ModelMetadataChange,
): Either.Either<Model, SetModelMetadataFailure> {
  const refusal = refusedText(change);
  if (refusal !== undefined) {
    return Either.left(refusal);
  }
  const held = model.metadata;
  const next: ModelMetadata = {
    title: change.title ?? held.title,
    owner: change.owner ?? held.owner,
    description: change.description ?? held.description,
    contributors: change.contributors ?? held.contributors,
  };
  return Either.right(
    sameMetadata(held, next)
      ? model
      : {
          ...model,
          metadata: { ...next, contributors: [...next.contributors] },
        },
  );
}

const textFields = ['title', 'owner', 'description'] as const;

function refusedText(
  change: ModelMetadataChange,
): SetModelMetadataFailure | undefined {
  for (const field of textFields) {
    const text = change[field];
    const at = text === undefined ? undefined : firstRefusedCharacter(text);
    if (at !== undefined) {
      return OperationFailure.RefusedMetadataCharacter({ field, at });
    }
  }
  for (const [contributor, name] of (change.contributors ?? []).entries()) {
    const at = firstRefusedCharacter(name);
    if (at !== undefined) {
      return OperationFailure.RefusedContributorCharacter({ contributor, at });
    }
  }
  return undefined;
}

function sameMetadata(held: ModelMetadata, next: ModelMetadata): boolean {
  return (
    textFields.every((field) => held[field] === next[field]) &&
    held.contributors.length === next.contributors.length &&
    held.contributors.every((name, index) => name === next.contributors[index])
  );
}
