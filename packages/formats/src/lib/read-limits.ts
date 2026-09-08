import { Either } from 'effect';
import { ReadFailure } from './codec.js';
import { isKeyed } from './records.js';

const encoder = new TextEncoder();

/** Shared resource bounds for parsing and importing foreign documents. */
export const readLimits = Object.freeze({
  /** UTF-8 input bytes, checked before parsing. */
  maxTextBytes: 4_194_304,
  /** Cumulative UTF-16 units charged for reference expansion and escaped identifiers. */
  maxImportTextUnits: 16_777_216,
  /** Maximum parsed depth, including values in extension maps. */
  maxNestingDepth: 64,
  /** Expanded YAML alias count, checked before resolving aliases. */
  maxAliasCount: 50,
  /** Nodes reached through YAML aliases, checked before resolving aliases. */
  maxAliasExpansion: 100_000,
});

/** Which bound a read stopped on, named as {@link readLimits} names it. */
export type ReadLimit = keyof typeof readLimits;

/**
 * A read stopped by a bound, carrying the number it was set to and what
 * the read had measured when it stopped. For `maxTextBytes` the
 * measurement is the text's UTF-8 byte count, or its UTF-16 length where
 * that alone breaks the bound, since a text that long is refused without
 * being measured further and its UTF-8 length is never below it. Where a
 * read stops rather than measuring on, which is the nesting walk and both
 * alias measurements, it is one past the bound: none of the three is taken
 * further than the answer needs.
 */
export function exceededReadLimit(
  limit: ReadLimit,
  observed: number,
): ReadFailure {
  return ReadFailure.ExceededReadLimit({
    limit,
    bound: readLimits[limit],
    observed,
  });
}

/** Checks text size before parsing and graph depth before schema validation. */
export function parseWithinLimits(
  text: string,
  parse: (text: string) => Either.Either<unknown, ReadFailure>,
): Either.Either<unknown, ReadFailure> {
  return Either.flatMap(withinTextLimit(text), (bounded) =>
    Either.flatMap(parse(bounded), withinNestingLimit),
  );
}

/** Refuses text whose UTF-8 size exceeds the shared read bound. */
export function withinTextLimit(
  text: string,
): Either.Either<string, ReadFailure> {
  const observed =
    text.length > readLimits.maxTextBytes
      ? text.length
      : encoder.encode(text).length;
  return observed > readLimits.maxTextBytes
    ? Either.left(exceededReadLimit('maxTextBytes', observed))
    : Either.right(text);
}

function withinNestingLimit(
  value: unknown,
): Either.Either<unknown, ReadFailure> {
  return deeperThanLimit(value)
    ? Either.left(
        exceededReadLimit('maxNestingDepth', readLimits.maxNestingDepth + 1),
      )
    : Either.right(value);
}

function deeperThanLimit(value: unknown): boolean {
  const reached = new Map<object, number>();
  let frontier: readonly unknown[] = [value];
  let depth = 0;
  while (frontier.length > 0) {
    if (depth > readLimits.maxNestingDepth) {
      return true;
    }
    frontier = frontier.flatMap((node) => childrenOf(node, depth, reached));
    depth += 1;
  }
  return false;
}

function childrenOf(
  node: unknown,
  depth: number,
  reached: Map<object, number>,
): readonly unknown[] {
  if (!isKeyed(node)) {
    return [];
  }
  const deepest = reached.get(node);
  if (deepest !== undefined && deepest >= depth) {
    return [];
  }
  reached.set(node, depth);
  return Object.values(node);
}
