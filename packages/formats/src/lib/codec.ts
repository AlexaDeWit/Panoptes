import type { Model, ParseIssue } from '@panoptes/model';
import { Data, type Either } from 'effect';
import type { z } from 'zod';
import type { LossReport } from './loss.js';

/**
 * Why a codec refused a text, one variant per place a read stops.
 * `MalformedText` is the text failing the format's own syntax, before any
 * path into a document exists, so it carries the parser's message alone.
 * `InvalidWireDocument` is the text parsing but the format's wire schema
 * refusing it, with paths into the wire document. `InvalidModel` is the
 * wire document mapping to something `parseModel` refuses, with paths into
 * the internal model. The two schema variants carry the model package's
 * {@link ParseIssue}, so a caller reads issues one way whichever boundary
 * produced them.
 */
export type ReadFailure = Data.TaggedEnum<{
  MalformedText: { readonly message: string };
  InvalidWireDocument: { readonly issues: readonly ParseIssue[] };
  InvalidModel: { readonly issues: readonly ParseIssue[] };
}>;

/**
 * Constructors for {@link ReadFailure}, one per variant, plus Effect's
 * `$is` and `$match` helpers. Values compare structurally under Effect's
 * Equal and serialize to their plain tagged shape.
 */
export const ReadFailure = Data.taggedEnum<ReadFailure>();

/**
 * What a read produced: the internal model, and the wire document it was
 * mapped from. The document comes back so a later write can merge onto it
 * instead of serializing the model from scratch, which is the only way
 * fields Panoptes does not model (Threat Dragon's ports, styling, and
 * z-order among them) can reach the output. The document stays in this
 * package: the model package is the format-independent authority and holds
 * no format's shape.
 */
export type ReadResult<WireSchema extends z.ZodType<object>> = {
  readonly model: Model;
  readonly source: z.infer<WireSchema>;
};

/** What a write produced: the output text, and what it did not carry. */
export type WriteResult = {
  readonly output: string;
  readonly loss: LossReport;
};

/**
 * A file format, read and written.
 *
 * The type parameter is the format's own zod schema, `wire` carries it as a
 * member, and the document types are that schema's inference. A codec
 * therefore cannot present a read path whose document type stands free of a
 * schema it holds, and the `object` output bound keeps `z.unknown()` out of
 * the position.
 *
 * `write` takes the source document as an option, and that option is the
 * whole difference between the two paths: given one it merges onto it,
 * given none it projects the model into the format's canonical form.
 * Both paths report through one {@link LossReport}, format-induced loss
 * when projecting and edit-induced loss when merging, and a merge of an
 * unedited model onto the document it was read from is required to report
 * none.
 *
 * `write` returns no `Either` because a model always produces text: what
 * the format cannot hold becomes a report entry rather than a failure.
 */
export interface Codec<WireSchema extends z.ZodType<object>> {
  readonly wire: WireSchema;
  read(text: string): Either.Either<ReadResult<WireSchema>, ReadFailure>;
  write(model: Model, source?: z.infer<WireSchema>): WriteResult;
}
