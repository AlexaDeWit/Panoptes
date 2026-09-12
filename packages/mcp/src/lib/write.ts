import {
  divergenceSchema,
  escapedForTerminal,
  formatNameSchema,
  quotedForTerminal,
  readLimits,
  renderDivergences,
  withinTextBytes,
  type DetectedRead,
  type WriteResult,
} from '@saerskriven/formats';
import type { Model } from '@saerskriven/model';
import { Data, Either } from 'effect';
import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  linkSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { z } from 'zod';
import { fileArgumentSchema } from './inspect.js';
import { revisionOf } from './revision.js';
import {
  reasonOf,
  type ModelWorkspace,
  type ReadModelFile,
} from './workspace.js';

/**
 * Why a write produced no file, in the order a tool reaches the checks.
 * `NoFile` is a call naming no file against a server carrying no default.
 * `StaleRevision` is the file having changed since the read whose handle the
 * call quoted, which is the case an agent answers by reading again rather
 * than by retrying, and which a write that replaces a file checks twice.
 * `Occupied` is a tool that creates a file finding a path already taken.
 * `PastReadBound` is the text a write would produce being past the size this
 * server reads, refused so a file the server wrote is one it can open again.
 * `Unwritten` is the write not happening for a reason outside this server's
 * reach: the system refusing it, the file on disk past the read bound, or the
 * codec throwing on the model it was handed, each with its own sentence.
 */
export type WriteFailure = Data.TaggedEnum<{
  NoFile: { readonly root: string };
  StaleRevision: {
    readonly file: string;
    readonly quoted: string;
    readonly found: string;
  };
  Occupied: { readonly file: string };
  PastReadBound: { readonly file: string; readonly size: number };
  Unwritten: { readonly file: string; readonly reason: string };
}>;

/**
 * Constructors for {@link WriteFailure}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const WriteFailure = Data.taggedEnum<WriteFailure>();

/** Where a write is going: the spelling a result names, and the path on disk. */
export type WriteTarget = {
  readonly file: string;
  readonly path: string;
};

/**
 * The `revision` a write quotes back, beside the `file` argument every tool
 * of this server takes.
 */
export const revisionArgumentSchema = fileArgumentSchema.extend({
  revision: z
    .string()
    .describe(
      'The revision handle the last read of this file returned. The write is refused when the file no longer hashes to it, checked when this call reads the file and again immediately before the file is replaced, which means something else wrote the file and the edit has to be reconsidered against what it holds now. The second check is not a lock: a save landing between it and the replacement is still overwritten.',
    ),
});

/** What every write tool reports about the file it produced. */
export const writeReportSchema = z.object({
  file: z.string(),
  format: formatNameSchema,
  revision: z.string(),
  divergences: z.array(divergenceSchema),
});

/** The file a write produced, as the lines its text result carries. */
export function renderWriteReport(
  report: z.infer<typeof writeReportSchema>,
): readonly string[] {
  return [
    `file: ${escapedForTerminal(report.file)}`,
    `format: ${report.format}`,
    `revision: ${report.revision}`,
    'divergences:',
    renderDivergences(report.divergences),
  ];
}

/** Why nothing was written, as the lines a refused tool result carries. */
export function renderWriteFailure(failure: WriteFailure): readonly string[] {
  return WriteFailure.$match(failure, {
    NoFile: ({ root }) => [
      `No file was named and this server carries no default, so there is nothing to write under ${quotedForTerminal(root)}.`,
      'Name the file to write in the `file` argument.',
    ],
    StaleRevision: ({ file, quoted, found }) => [
      `The file ${quotedForTerminal(file)} changed since the read this call quoted, so nothing was written.`,
      `The call quoted ${quoted}, and the file on disk is ${found}.`,
      'Read the file again and reconsider the edit against what it holds now.',
    ],
    Occupied: ({ file }) => [
      `The file ${quotedForTerminal(file)} is already there, and this tool writes only a path that is free.`,
    ],
    PastReadBound: ({ file, size }) => [
      `The file ${quotedForTerminal(file)} was not written: what this call would write is ${String(size)} bytes, past the size this server reads (${String(readLimits.maxTextBytes)} bytes), so the server could not open it again.`,
      'Whatever the path held before is unchanged. The file has to stay within that size, so write less into it: a smaller change for an edit, a smaller source for an import.',
    ],
    Unwritten: ({ file, reason }) => [
      `The file ${quotedForTerminal(file)} was not written: ${escapedForTerminal(reason)}.`,
    ],
  });
}

/** The file a call names, or the default the server carries. */
export function namedFile(
  workspace: ModelWorkspace,
  file: string | undefined,
): Either.Either<string, WriteFailure> {
  const named = file ?? workspace.defaultFile;
  return named === undefined
    ? Either.left(WriteFailure.NoFile({ root: workspace.root }))
    : Either.right(named);
}

/**
 * The read a write may go on from, refused where the file no longer hashes
 * to the revision the call quoted. This is the first of the two places the
 * handle is checked, over the bytes this call read, so what it refuses is an
 * agent editing a model it has moved past. A save landing after this read is
 * the other check's to catch, in {@link replacedFile}. Neither is a lock on
 * the file.
 */
export function unchangedSince(
  file: string,
  revision: string,
  read: ReadModelFile,
): Either.Either<ReadModelFile, WriteFailure> {
  return Either.map(staleUnless(file, revision, read.revision), () => read);
}

/**
 * `text` in place of whatever `target` holds, through a temporary file in
 * the target's own directory and a rename onto it, so a reader of the target
 * sees the file it had or the file this wrote and nothing between them. The
 * mode the target carried is put on the temporary first, since the rename
 * replaces the file's permissions along with its content. The handle over
 * the bytes written comes back, which is the revision the next write quotes.
 * `created` names the mode for a target that is not there, which is the
 * caller's to pass where a rename onto a free path is what it wants. A text
 * past the read bound refuses as `PastReadBound` before anything is written.
 *
 * `quoted` is the handle over the bytes the caller read, and the target is
 * hashed again immediately before the rename: one that no longer matches
 * refuses as `StaleRevision` and renames nothing, which is how a save that
 * landed while this call was working is reported rather than replaced. The
 * unguarded interval left runs from that hash to the rename rather than from
 * the caller's read to it, and a save landing inside it is still replaced
 * with neither writer told. A target that cannot be hashed refuses as
 * `Unwritten` instead, gone or grown past the bound this server reads, since
 * what the path holds then is not known.
 */
export function replacedFile(
  target: WriteTarget,
  text: string,
  quoted: string,
  created?: number,
): Either.Either<string, WriteFailure> {
  return Either.flatMap(readableBytes(target, text), (bytes) =>
    throughTemporary(
      target,
      bytes,
      (temporary) =>
        Either.flatMap(unmovedSince(target, quoted), () =>
          Either.try({
            try: () => {
              renameSync(temporary, target.path);
            },
            catch: (error) => unwritten(target.file, error),
          }),
        ),
      created,
    ),
  );
}

/**
 * {@link createdBytes} for a text, which is what a codec produces, refused as
 * `PastReadBound` where the text is past the size this server reads.
 */
export function createdFile(
  target: WriteTarget,
  text: string,
  created?: number,
): Either.Either<string, WriteFailure> {
  return Either.flatMap(readableBytes(target, text), (bytes) =>
    createdBytes(target, bytes, created),
  );
}

/**
 * `bytes` as a file at `target`, refused where the path is taken. The
 * temporary file is linked onto the target rather than renamed onto it,
 * which is what makes the refusal and the write one step: a rename replaces
 * whatever the path holds, where a link fails on a path that holds anything.
 *
 * That is also why it needs no second hash of the target where
 * {@link replacedFile} does, since there is no interval between a check and
 * the write for another writer to land in.
 *
 * A projection is bytes rather than text, and a picture written over a model
 * would be a loss nothing reports, so the path has to be free here as well.
 * `created` is the mode the file is given, since a path that is free carries
 * none of its own.
 */
export function createdBytes(
  target: WriteTarget,
  bytes: Uint8Array,
  created?: number,
): Either.Either<string, WriteFailure> {
  return throughTemporary(
    target,
    bytes,
    (temporary) =>
      Either.try({
        try: () => {
          linkSync(temporary, target.path);
        },
        catch: (error) => occupiedOrUnwritten(target.file, error),
      }),
    created,
  );
}

/**
 * What a serializer produced, or the refusal where it threw. A codec answers
 * with its text rather than with a result union, and so does a third-party
 * writer, so the throw neither promises is contained here: an exception
 * reaching the transport would lose the tool result, and with it the line
 * that says the text is data.
 */
export function serialized<Value>(
  file: string,
  write: () => Value,
): Either.Either<Value, WriteFailure> {
  return Either.try({
    try: write,
    catch: (error) => unwritten(file, error),
  });
}

/**
 * The model through the codec that read the file, merged onto the document
 * that read produced, so what the format carries and Saerskriven does not
 * model stays in the file. The branches differ in the codec each narrows to:
 * the detected read pairs a source document with the codec that produced it,
 * and writing one format's document through another format's codec is what
 * the union exists to rule out.
 */
export function writtenThrough(read: DetectedRead, model: Model): WriteResult {
  return read.format === 'threat-dragon'
    ? read.codec.write(model, read.source)
    : read.codec.write(model, read.source);
}

const errnoSchema = z.object({ code: z.string() });

function readableBytes(
  target: WriteTarget,
  text: string,
): Either.Either<Buffer, WriteFailure> {
  const bytes = Buffer.from(text, 'utf8');
  return withinTextBytes(bytes.length)
    ? Either.right(bytes)
    : Either.left(
        WriteFailure.PastReadBound({ file: target.file, size: bytes.length }),
      );
}

function throughTemporary(
  target: WriteTarget,
  bytes: Uint8Array,
  commit: (temporary: string) => Either.Either<void, WriteFailure>,
  created?: number,
): Either.Either<string, WriteFailure> {
  const temporary = join(
    dirname(target.path),
    `.${basename(target.path)}.${randomUUID()}.saer`,
  );
  return discarding(
    temporary,
    Either.flatMap(
      Either.flatMap(staged(target, temporary, bytes, created), () =>
        commit(temporary),
      ),
      () =>
        Either.try({
          try: () => revisionOf(bytes),
          catch: (error) => unwritten(target.file, error),
        }),
    ),
  );
}

function staged(
  target: WriteTarget,
  temporary: string,
  bytes: Uint8Array,
  created?: number,
): Either.Either<void, WriteFailure> {
  const mode = modeOf(target.path) ?? created;
  return Either.try({
    try: () => {
      writeFileSync(
        temporary,
        bytes,
        mode === undefined ? undefined : { mode },
      );
      if (mode !== undefined) {
        chmodSync(temporary, mode);
      }
    },
    catch: (error) => unwritten(target.file, error),
  });
}

function unmovedSince(
  target: WriteTarget,
  quoted: string,
): Either.Either<void, WriteFailure> {
  return Either.flatMap(rehashed(target), (found) =>
    staleUnless(target.file, quoted, found),
  );
}

function rehashed(target: WriteTarget): Either.Either<string, WriteFailure> {
  return Either.flatMap(
    Either.try({
      try: () => statSync(target.path).size,
      catch: (error) => unwritten(target.file, error),
    }),
    (size) =>
      withinTextBytes(size)
        ? Either.try({
            try: () => revisionOf(readFileSync(target.path)),
            catch: (error) => unwritten(target.file, error),
          })
        : Either.left(
            WriteFailure.Unwritten({
              file: target.file,
              reason: `it is now ${String(size)} bytes, past the ${String(readLimits.maxTextBytes)} this server reads`,
            }),
          ),
  );
}

function staleUnless(
  file: string,
  quoted: string,
  found: string,
): Either.Either<void, WriteFailure> {
  return quoted === found
    ? Either.right(undefined)
    : Either.left(WriteFailure.StaleRevision({ file, quoted, found }));
}

function discarding<Outcome>(temporary: string, outcome: Outcome): Outcome {
  return Either.match(
    Either.try(() => {
      rmSync(temporary, { force: true });
    }),
    { onLeft: () => outcome, onRight: () => outcome },
  );
}

function modeOf(path: string): number | undefined {
  return Either.getOrUndefined(Either.try(() => statSync(path).mode & 0o777));
}

function unwritten(file: string, error: unknown): WriteFailure {
  return WriteFailure.Unwritten({ file, reason: reasonOf(error) });
}

function occupiedOrUnwritten(file: string, error: unknown): WriteFailure {
  const errno = errnoSchema.safeParse(error);
  return errno.success && errno.data.code === 'EEXIST'
    ? WriteFailure.Occupied({ file })
    : unwritten(file, error);
}
