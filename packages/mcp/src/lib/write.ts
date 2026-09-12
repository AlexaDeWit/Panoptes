import {
  divergenceSchema,
  escapedForTerminal,
  formatNameSchema,
  quotedForTerminal,
  renderDivergences,
  type DetectedRead,
  type WriteResult,
} from '@saerskriven/formats';
import type { Model } from '@saerskriven/model';
import { Data, Either } from 'effect';
import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  linkSync,
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
 * than by retrying. `Occupied` is a tool that creates a file finding a path
 * already taken. `Unwritten` is the write not happening for a reason outside
 * this server's reach: the system refusing it, or the codec throwing on the
 * model it was handed, each with its own sentence.
 */
export type WriteFailure = Data.TaggedEnum<{
  NoFile: { readonly root: string };
  StaleRevision: {
    readonly file: string;
    readonly quoted: string;
    readonly found: string;
  };
  Occupied: { readonly file: string };
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
      'The revision handle the last read of this file returned. The write is refused when the file no longer hashes to it, which means something else wrote the file and the edit has to be reconsidered against what it holds now.',
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
 * to the revision the call quoted. The comparison is between whole handles
 * over the bytes this call read, which is what it catches and what it does
 * not: a save that landed before this read is refused, and a save landing
 * between this read and the rename that follows it is not seen, so that
 * writer's work is replaced with neither side told. The window is the read,
 * the edits and the serialization, milliseconds on a large model. The handle
 * refuses an agent editing a model it has moved past; it is not a lock on
 * the file.
 */
export function unchangedSince(
  file: string,
  revision: string,
  read: ReadModelFile,
): Either.Either<ReadModelFile, WriteFailure> {
  return read.revision === revision
    ? Either.right(read)
    : Either.left(
        WriteFailure.StaleRevision({
          file,
          quoted: revision,
          found: read.revision,
        }),
      );
}

/**
 * `text` in place of whatever `target` holds, through a temporary file in
 * the target's own directory and a rename onto it, so a reader of the target
 * sees the file it had or the file this wrote and nothing between them. The
 * mode the target carried is put on the temporary first, since the rename
 * replaces the file's permissions along with its content. The handle over
 * the bytes written comes back, which is the revision the next write quotes.
 */
export function replacedFile(
  target: WriteTarget,
  text: string,
): Either.Either<string, WriteFailure> {
  return throughTemporary(
    target,
    text,
    (temporary) => {
      renameSync(temporary, target.path);
    },
    unwritten,
  );
}

/**
 * `text` as a file at `target`, refused where the path is taken. The
 * temporary file is linked onto the target rather than renamed onto it,
 * which is what makes the refusal and the write one step: a rename replaces
 * whatever the path holds, where a link fails on a path that holds anything.
 */
export function createdFile(
  target: WriteTarget,
  text: string,
): Either.Either<string, WriteFailure> {
  return throughTemporary(
    target,
    text,
    (temporary) => {
      linkSync(temporary, target.path);
    },
    occupiedOrUnwritten,
  );
}

/**
 * The text a codec produced, or the refusal where it threw. A codec answers
 * with text rather than with a result union, so the throw it does not
 * promise is contained here: an exception reaching the transport would lose
 * the tool result, and with it the line that says the text is data.
 */
export function serialized(
  file: string,
  write: () => WriteResult,
): Either.Either<WriteResult, WriteFailure> {
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

function throughTemporary(
  target: WriteTarget,
  text: string,
  commit: (temporary: string) => void,
  refusal: (file: string, error: unknown) => WriteFailure,
): Either.Either<string, WriteFailure> {
  const bytes = Buffer.from(text, 'utf8');
  const temporary = join(
    dirname(target.path),
    `.${basename(target.path)}.${randomUUID()}.saer`,
  );
  const mode = modeOf(target.path);
  const written = Either.try({
    try: () => {
      writeFileSync(
        temporary,
        bytes,
        mode === undefined ? undefined : { mode },
      );
      if (mode !== undefined) {
        chmodSync(temporary, mode);
      }
      commit(temporary);
      return revisionOf(bytes);
    },
    catch: (error) => refusal(target.file, error),
  });
  return discarding(temporary, written);
}

/**
 * The outcome unchanged, with the temporary file removed. A removal that
 * fails leaves the outcome alone: whether the temporary is still there says
 * nothing about the file the write was for.
 */
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
