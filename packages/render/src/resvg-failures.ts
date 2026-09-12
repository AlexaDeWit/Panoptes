import { Data } from 'effect';

/**
 * Why a rasterization produced no PNG: `_tag` discriminates the refusal,
 * following Effect's own convention. `Refused` is about what was asked for,
 * carrying the sentence the renderer reported about the document or this
 * package's own about a long edge it will not pass on, and `Unusable` is
 * about the assets: a module that would not start, one that stopped partway
 * or reserved none of the memory it was asked for, and a buffer holding no
 * face the renderer reads. The wording around them belongs to whoever calls:
 * a command prints them and a browser shows them.
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
