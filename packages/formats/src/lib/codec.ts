import type { Model, ParseIssue } from '@panoptes/model';
import { Data, type Either } from 'effect';
import { z } from 'zod';
import type { LossReport } from './loss.js';

/**
 * One value of a parsed wire document: the space JSON and YAML both parse
 * into, so a codec of either kind describes its source the same way.
 */
export const wireValueSchema = z.json();

/** One value of a parsed wire document. */
export type WireValue = z.infer<typeof wireValueSchema>;

/**
 * A parsed wire document, as the format's own parser produced it. A codec
 * hands this back unreduced, because it is the template a write merges
 * onto: a field Panoptes does not model reaches the output only where
 * nothing in the read path removed it. The document lives in this package,
 * so the model package stays the format-independent authority and holds no
 * format's shape.
 */
export const wireDocumentSchema = z.record(z.string(), wireValueSchema);

/** A parsed wire document. */
export type WireDocument = z.infer<typeof wireDocumentSchema>;

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
 * z-order among them) can reach the output.
 */
export type ReadResult = {
  readonly model: Model;
  readonly source: WireDocument;
};

/** What a write produced: the output text, and what it did not carry. */
export type WriteResult = {
  readonly output: string;
  readonly loss: LossReport;
};

/**
 * A file format, read and written.
 *
 * The type parameter is the format's own zod schema and `wire` carries it
 * as a member, so the contract cannot describe a codec that has no wire
 * schema, and the `object` output bound keeps `z.unknown()` out of the
 * position. The schema works inside `read`: typed access to the document,
 * the paths `InvalidWireDocument` reports, and the mapping into the model.
 * It is not the write template, which is the raw document {@link read}
 * returns.
 *
 * Two obligations on a wire schema that the types do not carry. It stays
 * tolerant of keys it does not declare, because a foreign file holds
 * fields Panoptes does not model and a strict schema stops reading the
 * file the first time the other tool adds one. And it neither transforms
 * nor coerces a value it round-trips, or the raw document and the mapped
 * model disagree about what the file said.
 *
 * `write` takes the source document as an option, and that option is the
 * whole difference between the two paths: given one it merges onto it,
 * given none it projects the model into the format's canonical form. Both
 * paths report through one {@link LossReport}, format-induced loss when
 * projecting and edit-induced loss when merging, and a merge of an
 * unedited model onto the document it was read from is required to report
 * none.
 *
 * Nothing pairs a document with the model it was read from. Passing a
 * document from some other read merges onto the wrong file, and passing
 * none after a read failed takes the projection path, which drops
 * everything the file held outside the model. Both are the caller's to get
 * right.
 *
 * `write` returns no `Either` because a model always produces text: what
 * the format cannot hold becomes a report entry rather than a failure.
 */
export interface Codec<WireSchema extends z.ZodType<object>> {
  readonly wire: WireSchema;
  read(text: string): Either.Either<ReadResult, ReadFailure>;
  write(model: Model, source?: WireDocument): WriteResult;
}
