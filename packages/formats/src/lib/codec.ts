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
 * What a read produced: the internal model, the wire document it was mapped
 * from, and what the read itself dropped. The document comes back so a
 * later write can merge onto it instead of serializing the model from
 * scratch, which is how the parts of a file Panoptes does not model reach
 * the output: the wire schema declares them, so a merge that does not touch
 * them leaves them as the file had them. `loss` names the keys the schema
 * did not declare and so did not keep, which is the read side of the same
 * report a write returns.
 */
export type ReadResult<WireSchema extends z.ZodType<object>> = {
  readonly model: Model;
  readonly source: z.infer<WireSchema>;
  readonly loss: LossReport;
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
 * member, and the document types are that schema's inference. So the
 * contract cannot describe a codec that has no wire schema, the `object`
 * output bound keeps `z.unknown()` out of the position, and `write` accepts
 * only a document its own schema describes.
 *
 * What a wire schema owes this contract, none of which the types check. It
 * declares everything its format carries, the parts Panoptes does not model
 * included, because that completeness is what preserves them: a merge
 * leaves untouched what it does not map, and only a declared key is there
 * to leave alone. It is demanding about what it declares and silent about
 * the rest, which it drops rather than carries, so `read` reports a dropped
 * key as loss and an incomplete schema announces itself. And it neither
 * transforms nor coerces a value it round-trips, or the document and the
 * model disagree about what the file said.
 *
 * `write` takes the source document as an option, and that option is the
 * whole difference between the two paths: given one it merges onto it,
 * given none it projects the model into the format's canonical form. Both
 * paths report through one {@link LossReport}, format-induced loss when
 * projecting and edit-induced loss when merging, and a merge of an unedited
 * model onto the document it was read from is required to report none.
 *
 * The type pairs a document with its format, not with a model or a file, so
 * merging onto a document of the right format that some other read produced
 * writes the wrong file, and passing none after a read failed takes the
 * projection path and drops everything the file held outside the model.
 * Both are the caller's to get right.
 *
 * `write` returns no `Either` because a model always produces text: what
 * the format cannot hold becomes a report entry rather than a failure.
 * Nothing else produces the write-side report, so a caller asking what a
 * save would cost before saving calls `write` and discards the output.
 */
export interface Codec<WireSchema extends z.ZodType<object>> {
  readonly wire: WireSchema;
  read(text: string): Either.Either<ReadResult<WireSchema>, ReadFailure>;
  write(model: Model, source?: z.infer<WireSchema>): WriteResult;
}
