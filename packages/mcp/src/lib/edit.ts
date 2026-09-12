import { Either, pipe } from 'effect';
import type { Model } from '@saerskriven/model';
import { z } from 'zod';
import {
  applyEdits,
  editOps,
  modelEditSchema,
  renderRefusedEdit,
} from './edits.js';
import {
  namedFile,
  renderWriteFailure,
  renderWriteReport,
  replacedFile,
  revisionArgumentSchema,
  serialized,
  unchangedSince,
  writeReportSchema,
  writtenThrough,
} from './write.js';
import {
  readModelFile,
  renderWorkspaceFailure,
  withinRoot,
  type ModelWorkspace,
  type ReadModelFile,
} from './workspace.js';

/** What `saer_edit` takes: the file, the handle it was read at, and the batch. */
export const editArgumentsSchema = revisionArgumentSchema.extend({
  edits: z
    .array(modelEditSchema)
    .min(1)
    .describe(
      'The edits to apply, in order. The batch is all or nothing: the first edit the model refuses stops it and nothing is written.',
    ),
});

/** What `saer_edit` takes. */
export type EditArguments = z.infer<typeof editArgumentsSchema>;

/** What `saer_edit` answers with. */
export const editResultSchema = writeReportSchema.extend({
  applied: z.int().positive(),
});

/** What `saer_edit` answers with. */
export type EditResult = z.infer<typeof editResultSchema>;

/** What `saer_edit` tells a client it is for. */
export const editDescription = [
  'Apply a batch of edits to one Saerskriven threat model file and save the file in the format it is already in.',
  'The edits are applied in order to one parsed model, and the file is written once at the end. The first edit the model refuses stops the batch: nothing is written, the file stays byte for byte as it was, and the result names the index that was refused and what the model said about it. The batch is the unit of change rather than the edit.',
  `Each edit is an object carrying \`op\` and that op's own fields. The ops are ${editOps.join(', ')}.`,
  'Pass `revision` as the handle the last read of this file returned. A file that changed before this call is refused rather than overwritten, and the answer to that refusal is to read the file again and reconsider the edit against what the file now holds. A change that lands while this call is running is not seen and is overwritten, so read the file in the same turn you edit it, and expect to lose an edit where somebody is working in the same file from another tool.',
  'A threat carries no number: the model issues one when a threat is added and holds it when the threat is replaced, so numbers name one threat for the life of a model and there is no edit that renumbers.',
  'Use this on a model that exists. Start a new one with saer_create and convert a foreign file with saer_import. What the file format cannot hold comes back in the divergences of the result rather than as a refusal, so read them after a write to a Threat Dragon file.',
].join(' ');

/**
 * The batch applied and the file written, or the lines saying why nothing
 * was written. The file is read, checked against the revision the call
 * quoted, and edited in memory, so every refusal here happens before
 * anything reaches the disk.
 */
export function editModel(
  workspace: ModelWorkspace,
  args: EditArguments,
): Either.Either<EditResult, readonly string[]> {
  return pipe(
    namedFile(workspace, args.file),
    Either.mapLeft(renderWriteFailure),
    Either.flatMap((named) =>
      Either.mapLeft(readModelFile(workspace, named), renderWorkspaceFailure),
    ),
    Either.flatMap((read) =>
      Either.mapLeft(
        unchangedSince(withinRoot(workspace, read.path), args.revision, read),
        renderWriteFailure,
      ),
    ),
    Either.flatMap((read) =>
      Either.mapBoth(applyEdits(read.read.model, args.edits), {
        onLeft: renderRefusedEdit,
        onRight: (model) => ({ read, model }),
      }),
    ),
    Either.flatMap(({ read, model }) =>
      saved(workspace, read, model, args.edits.length),
    ),
  );
}

/** The edited file as the lines its text result carries. */
export function renderEdit(result: EditResult): readonly string[] {
  return [
    `edits applied: ${String(result.applied)}`,
    ...renderWriteReport(result),
  ];
}

function saved(
  workspace: ModelWorkspace,
  read: ReadModelFile,
  model: Model,
  applied: number,
): Either.Either<EditResult, readonly string[]> {
  const file = withinRoot(workspace, read.path);
  return pipe(
    serialized(file, () => writtenThrough(read.read, model)),
    Either.flatMap((written) =>
      Either.map(
        replacedFile({ file, path: read.path }, written.output),
        (revision): EditResult => ({
          file,
          format: read.read.format,
          revision,
          applied,
          divergences: [...written.divergences],
        }),
      ),
    ),
    Either.mapLeft(renderWriteFailure),
  );
}
