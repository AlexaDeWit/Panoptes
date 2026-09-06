import { Data } from 'effect';

/**
 * Why a compile produced no PDF: `_tag` discriminates the refusal, following
 * Effect's own convention. `Refused` carries the compiler's diagnostics as
 * the sentences a reader needs, in the order the compiler reported them, and
 * `NoDocument` is the compiler answering with something that is not bytes,
 * which no source this package writes should provoke. The wording around
 * them belongs to whoever calls: a command prints them and a browser shows
 * them, and neither reads a message this package spelled for the other.
 */
export type PdfFailure = Data.TaggedEnum<{
  Refused: { readonly sentences: readonly string[] };
  NoDocument: object;
}>;

/**
 * Constructors for {@link PdfFailure}, one per variant, plus Effect's `$is`
 * and `$match` helpers. Values compare structurally under Effect's Equal and
 * serialize to their plain tagged shape.
 */
export const PdfFailure = Data.taggedEnum<PdfFailure>();
