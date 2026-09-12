import {
  escapedForTerminal,
  formatNameSchema,
  quotedForTerminal,
  type Divergence,
  type FormatName,
} from '@saerskriven/formats';
import type { Model } from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import {
  readModelFile,
  renderWorkspaceFailure,
  withinRoot,
  type ModelWorkspace,
} from './workspace.js';

/**
 * One model as a read tool has it: the path a result names it by, the format
 * that claimed it, the handle a write quotes back, the model itself, and what
 * the file and the model do not correspond on.
 */
export type ModelReading = {
  readonly file: string;
  readonly format: FormatName;
  readonly revision: string;
  readonly model: Model;
  readonly divergences: readonly Divergence[];
};

/**
 * What every read tool reports about the file it read. Each tool extends this
 * rather than restating the fields, so `revision` is on every result and a
 * write that follows a read in the same turn has its handle without a second
 * read.
 */
export const readingSchema = z.object({
  file: z.string(),
  format: formatNameSchema,
  revision: z.string(),
});

/** What every read tool reports about the file it read. */
export type Reading = z.infer<typeof readingSchema>;

/**
 * The model a call names, or the default the server carries, read on the
 * bounds {@link readModelFile} applies. A call naming neither is refused
 * rather than answered with a listing: `saer_inspect` is the tool that lists
 * what is under the root, and a query tool that listed instead would answer
 * something other than what it was asked.
 */
export function readNamed(
  workspace: ModelWorkspace,
  file: string | undefined,
): Either.Either<ModelReading, readonly string[]> {
  const named = file ?? workspace.defaultFile;
  return named === undefined
    ? Either.left(unnamed(workspace))
    : Either.mapBoth(readModelFile(workspace, named), {
        onLeft: renderWorkspaceFailure,
        onRight: (read) => ({
          file: withinRoot(workspace, read.path),
          format: read.read.format,
          revision: read.revision,
          model: read.read.model,
          divergences: read.read.divergences,
        }),
      });
}

/** The reading's own fields, as the lines a read result opens with. */
export function renderReading(reading: Reading): readonly string[] {
  return [
    `file: ${escapedForTerminal(reading.file)}`,
    `format: ${reading.format}`,
    `revision: ${reading.revision}`,
  ];
}

/** The reading's own fields, as every read result of this server carries them. */
export function reportedReading(reading: ModelReading): Reading {
  return {
    file: reading.file,
    format: reading.format,
    revision: reading.revision,
  };
}

function unnamed(workspace: ModelWorkspace): readonly string[] {
  return [
    `No file was named and this server carries no default, so there is nothing to read under ${quotedForTerminal(workspace.root)}.`,
    'Name the model in the `file` argument. Calling saer_inspect with no argument lists the model files under the root.',
  ];
}
