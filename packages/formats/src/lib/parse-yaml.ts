import { Either } from 'effect';
import { parseDocument, YAMLParseError } from 'yaml';
import { ReadFailure } from './codec.js';
import {
  aliasCostIn,
  type ComposedDocument,
} from './saerskriven-yaml-document.js';
import {
  exceededReadLimit,
  parseWithinLimits,
  readLimits,
} from './read-limits.js';

/** Parses YAML or JSON within the shared size, nesting, and alias bounds. */
export function parseYaml(text: string): Either.Either<unknown, ReadFailure> {
  return parseWithinLimits(text, (bounded) =>
    Either.flatMap(
      Either.flatMap(compose(bounded), withinAliasLimits),
      toValue,
    ),
  );
}

function compose(text: string): Either.Either<ComposedDocument, ReadFailure> {
  return Either.flatMap(
    Either.try({ try: () => parseDocument(text), catch: toReadFailure }),
    (document) => {
      const [refused] = document.errors;
      return refused === undefined
        ? Either.right(document)
        : Either.left(toReadFailure(refused));
    },
  );
}

function withinAliasLimits(
  document: ComposedDocument,
): Either.Either<ComposedDocument, ReadFailure> {
  const cost = aliasCostIn(document, {
    expanded: readLimits.maxAliasCount + 1,
    reached: readLimits.maxAliasExpansion + 1,
  });
  if (cost.expanded > readLimits.maxAliasCount) {
    return Either.left(exceededReadLimit('maxAliasCount', cost.expanded));
  }
  return cost.reached > readLimits.maxAliasExpansion
    ? Either.left(exceededReadLimit('maxAliasExpansion', cost.reached))
    : Either.right(document);
}

function toValue(
  document: ComposedDocument,
): Either.Either<unknown, ReadFailure> {
  return Either.try({
    try: () => document.toJS({ maxAliasCount: -1 }) as unknown,
    catch: toReadFailure,
  });
}

function toReadFailure(error: unknown): ReadFailure {
  if (error instanceof YAMLParseError && error.code === 'RESOURCE_EXHAUSTION') {
    return exceededReadLimit('maxNestingDepth', readLimits.maxNestingDepth + 1);
  }
  return ReadFailure.MalformedText({ message: String(error) });
}
