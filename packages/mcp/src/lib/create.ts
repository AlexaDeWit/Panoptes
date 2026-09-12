import { readLimits, saerskrivenYamlCodec } from '@saerskriven/formats';
import { acceptedTextSchema, emptyModel, type Model } from '@saerskriven/model';
import { Either, pipe } from 'effect';
import { z } from 'zod';
import {
  createdFile,
  renderWriteFailure,
  serialized,
  writeReportSchema,
} from './write.js';
import {
  confined,
  renderWorkspaceFailure,
  withinRoot,
  type ModelWorkspace,
} from './workspace.js';

/** What `saer_create` takes: where the file goes and what the model is called. */
export const createArgumentsSchema = z.object({
  file: z
    .string()
    .describe(
      'Where to write the new model, as a path relative to the server root. The call is refused when a file is already there, so this never replaces one.',
    ),
  title: acceptedTextSchema.describe('What the model is called.'),
  owner: acceptedTextSchema
    .optional()
    .describe(
      'Who answers for the model. Left out, the field is written empty, and saer_edit sets it later with set_model_metadata.',
    ),
});

/** What `saer_create` takes. */
export type CreateArguments = z.infer<typeof createArgumentsSchema>;

/** What `saer_create` answers with. */
export type CreateResult = z.infer<typeof writeReportSchema>;

/** What `saer_create` tells a client it is for. */
export const createDescription = [
  'Write a new Saerskriven threat model file: the native YAML format, the title and owner this call gives it, and no diagram, threat, mitigation or assumption yet.',
  'Pass `file` as the path to write, relative to the server root. A path already holding a file is refused rather than replaced: to change a model that exists, read it and call saer_edit.',
  'The result carries the `revision` of the file it wrote, which is the handle the first saer_edit on it has to quote back, so a create and an edit run in one turn without a read between them.',
  `A model past ${String(readLimits.maxTextBytes / 1_048_576)} MiB, the size this server reads, is refused and not written, since the server could not open it again.`,
  'Fill the model in with saer_edit: add a diagram first, then the elements, then the threats that attach to them. Its set_model_metadata op sets the owner, description and contributors.',
].join(' ');

/**
 * The new file, or the lines saying why there is none. Nothing is read: the
 * model is the empty one this package holds, with the metadata this call
 * names.
 */
export function createModel(
  workspace: ModelWorkspace,
  args: CreateArguments,
): Either.Either<CreateResult, readonly string[]> {
  return pipe(
    confined(workspace, args.file),
    Either.mapLeft(renderWorkspaceFailure),
    Either.flatMap((path) => started(workspace, path, args)),
  );
}

function started(
  workspace: ModelWorkspace,
  path: string,
  args: CreateArguments,
): Either.Either<CreateResult, readonly string[]> {
  const file = withinRoot(workspace, path);
  return pipe(
    serialized(file, () => saerskrivenYamlCodec.write(titled(args))),
    Either.flatMap((written) =>
      Either.map(
        createdFile({ file, path }, written.output),
        (revision): CreateResult => ({
          file,
          format: 'saerskriven-yaml',
          revision,
          divergences: [...written.divergences],
        }),
      ),
    ),
    Either.mapLeft(renderWriteFailure),
  );
}

function titled(args: CreateArguments): Model {
  return {
    ...emptyModel,
    metadata: {
      title: args.title,
      owner: args.owner ?? '',
      description: '',
      contributors: [],
    },
  };
}
