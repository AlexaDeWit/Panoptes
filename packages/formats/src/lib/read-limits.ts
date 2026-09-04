import { Either } from 'effect';
import { ReadFailure } from './codec.js';
import { isKeyed } from './records.js';

const encoder = new TextEncoder();

/**
 * What a read may spend on a text before it refuses it. One value, so a
 * caller that checks a file before handing it to a codec, the studio open
 * path and the MCP load tool among them, enforces the numbers the codecs
 * enforce rather than numbers of its own.
 *
 * Each bound has headroom over the files the repository vendors: the
 * largest is `test-data/ecluse.json` at 138,208 bytes, the deepest threat
 * model nests twelve levels, and none of them carries an anchor. A file
 * within the bounds is read exactly as it was before the bounds existed.
 */
export const readLimits = Object.freeze({
  /**
   * The size of the text in UTF-8 bytes, about thirty times the largest
   * file the repository vendors. It is the bound that keeps every other
   * cost finite, since it runs before a parser sees the text, and what it
   * costs is what 4 MiB of YAML costs to read at all: 9 to 22 seconds
   * across two machines depending on the shape, linear in this number. A
   * plain alias-free flow sequence and a sequence aliased from forty
   * depths both cost more than flow nesting, which is the worst nesting
   * shape rather than the worst shape. That is the price of the cap and
   * not a bound failing to hold.
   */
  maxTextBytes: 4_194_304,
  /**
   * How far below the document root a value may sit, five times the
   * deepest threat model the repository vendors, which nests twelve. The
   * JSON Schema vendored beside those models nests seventeen and is handed
   * to no read. A threat model is a drawing with a fixed shape rather than
   * a tree, so nothing an editor writes approaches this, and a text that
   * does is either the 3,000-deep reproducer this bound exists for or a
   * cycle an alias closed.
   */
  maxNestingDepth: 64,
  /**
   * How many aliases resolving a document works through: one for each alias
   * it holds, plus the expanded aliases inside that alias's anchor. It
   * stands in for the `yaml` package's option of this name rather than
   * reproducing it, bounding the quantity that option exists to bound:
   * counted here as a sum over the whole document, where the parser takes a
   * product per anchor against a maximum over its children, so the two
   * report different numbers for the same file. This package measures it
   * rather than handing the parser a bound, because that accounting
   * resolves an alias by scanning the whole
   * document and takes that scan once per anchor, which costs more than
   * what it bounds: fifty aliases arranged as anchors within anchors in a
   * 4 MiB text spend 147 seconds inside the parser, where measuring them
   * here costs a fifth of a millisecond. The count is taken on the composed
   * document before any alias is resolved, since resolving is where the
   * cost is, and a cycle expands without end, so it is refused here rather
   * than further on.
   *
   * 50, half the parser's own default of 100. No file the repository
   * vendors carries an anchor at all, and the format's own writer emits
   * none, so the bound reaches hand-written files alone: it leaves room for
   * a repeated value and refuses a bomb that default admits.
   */
  maxAliasCount: 50,
  /**
   * How much of a document its aliases may reach: the nodes under each
   * alias's anchor, summed over the aliases. The count of them bounds what
   * they cost only where they are alike, and they are not: a one-node
   * anchor is as cheap to alias as a two-million-node one. Forty aliases to
   * a sequence of two million elements sit inside every other bound, and
   * the nesting walk then spends six seconds on that sequence, walking it
   * again once per depth an alias reaches it from, where resolving the
   * whole document costs under half a second.
   *
   * 100,000 leaves what a hand-written file shares far below it: a repeated
   * threat record of twenty nodes reaches 1,000 across all fifty aliases
   * the count admits, and a repeated diagram of five hundred nodes reaches
   * 5,000 across ten. No file the repository vendors carries an anchor at
   * all, and the format's own writer emits none, so this bound reaches
   * hand-written files alone. What a file sitting at it can still cost is
   * this many nodes walked once per level of the nesting bound, which is
   * under what the size bound already admits.
   */
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

/**
 * A text parsed within {@link readLimits}, which is the one place a read
 * path passes its bounds.
 *
 * The size is measured before `parse` runs, since it is what keeps the
 * parse itself finite, and a text whose UTF-16 length alone breaks the
 * bound is refused without being measured in UTF-8, so an enormous text
 * costs no copy of itself. The nesting of what it parsed to is measured
 * after, by a walk carrying its own stack that stops one level past the
 * bound.
 *
 * That walk goes level by level and expands a node only when it reaches it
 * deeper than it has before, which bounds its total work at the depth bound
 * times the size of the value, an expansion costing the node's fan-out,
 * rather than at the number of paths through it. The two are not the same
 * count: an alias can be reached along many paths, and a cycle an alias
 * closed along infinitely many. A cycle is unbounded depth, so the walk
 * climbs it to the bound and refuses it there rather than following it.
 * Expanding on the deepest arrival rather than only on the first is what
 * keeps that sound: a subtree first met near the root and met again far
 * below it is measured from the lower of the two. It holds every distinct
 * node it has expanded for as long as it runs, so a document costs about
 * its own parsed size again while the walk is in progress.
 *
 * `parse` carries its own failures rather than throwing them, because the
 * two bounds here are the two that no format owns. A parser has resource
 * guards of its own, reports meeting one its own way, and may need a bound
 * of its own between its stages, and only the format knows any of that.
 */
export function parseWithinLimits(
  text: string,
  parse: (text: string) => Either.Either<unknown, ReadFailure>,
): Either.Either<unknown, ReadFailure> {
  return Either.flatMap(withinTextLimit(text), (bounded) =>
    Either.flatMap(parse(bounded), withinNestingLimit),
  );
}

function withinTextLimit(text: string): Either.Either<string, ReadFailure> {
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
