import { Data } from 'effect';

/**
 * Why a rasterization produced no PNG: `_tag` discriminates the refusal,
 * following Effect's own convention. `Refused` carries the sentence the
 * module reported about the document it was given, and `Unusable` the one a
 * module that would not start, or stopped partway, reported. The wording
 * around them belongs to whoever calls: a command prints them and a browser
 * shows them.
 */
export type ResvgFailure = Data.TaggedEnum<{
  Refused: { readonly sentence: string };
  Unusable: { readonly sentence: string };
}>;

/**
 * Constructors for {@link ResvgFailure}, one per variant, plus Effect's `$is`
 * and `$match` helpers. Values compare structurally under Effect's Equal and
 * serialize to their plain tagged shape.
 */
export const ResvgFailure = Data.taggedEnum<ResvgFailure>();
