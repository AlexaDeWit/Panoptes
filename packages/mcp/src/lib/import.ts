import {
  importFormatSchema,
  importModel,
  quotedForTerminal,
  readLimits,
  renderReadFailure,
  saerskrivenYamlCodec,
  type ImportResult as ConvertedModel,
} from '@saerskriven/formats';
import { Either, pipe } from 'effect';
import { z } from 'zod';
import {
  createdFile,
  renderWriteFailure,
  renderWriteReport,
  serialized,
  writeReportSchema,
} from './write.js';
import {
  confined,
  readTextFile,
  renderWorkspaceFailure,
  withinRoot,
  type ModelWorkspace,
} from './workspace.js';

/** What `saer_import` takes: the file to convert and where the model goes. */
export const importArgumentsSchema = z.object({
  file: z
    .string()
    .describe(
      'The OTM or TM-BOM file to convert, as a path relative to the server root.',
    ),
  target: z
    .string()
    .describe(
      'Where to write the converted model, as a path relative to the server root. The call is refused when a file is already there.',
    ),
});

/** What `saer_import` takes. */
export type ImportArguments = z.infer<typeof importArgumentsSchema>;

/** What `saer_import` answers with. */
export const importResultSchema = writeReportSchema.extend({
  source: z.object({ file: z.string(), format: importFormatSchema }),
});

/** What `saer_import` answers with. */
export type ImportResult = z.infer<typeof importResultSchema>;

/** What `saer_import` tells a client it is for. */
export const importDescription = [
  'Convert an Open Threat Model (OTM) or TM-BOM file into a new Saerskriven model in the native YAML format, and write it to a path that is free.',
  'Both formats are read only: Saerskriven maps them onto its own model and never writes them back, so the conversion is a one-way step and the file it produces is what later edits go to. Pass `file` as the source and `target` as the path to write, both relative to the server root. A target already holding a file is refused rather than replaced.',
  'What the conversion could not carry over comes back in the divergences of the result: a key the wire schema does not declare, a value reduced to fit, and geometry generated for a record whose source file states none. Read them before you rely on the converted model.',
  `A converted model past ${String(readLimits.maxTextBytes / 1_048_576)} MiB, the size this server reads, is refused and not written, since the server could not open it again.`,
  'To read a Threat Dragon or Saerskriven file, call saer_inspect instead: those formats are read and written in place and need no conversion.',
].join(' ');

/**
 * The converted model as a new file, or the lines saying why there is none.
 * The source is read through the same bounds every other read of this server
 * goes through, and the target is written only after the conversion produced
 * a model.
 */
export function importIntoModel(
  workspace: ModelWorkspace,
  args: ImportArguments,
): Either.Either<ImportResult, readonly string[]> {
  return pipe(
    readTextFile(workspace, args.file),
    Either.mapLeft(renderWorkspaceFailure),
    Either.flatMap((source) =>
      Either.mapLeft(importModel(source.text), (failure) => [
        `The file ${quotedForTerminal(args.file)} was not converted.`,
        ...renderReadFailure(failure),
      ]),
    ),
    Either.flatMap((imported) => converted(workspace, args, imported)),
  );
}

/** The converted model as the lines its text result carries. */
export function renderImport(result: ImportResult): readonly string[] {
  return [
    `converted: ${result.source.file} (${result.source.format})`,
    ...renderWriteReport(result),
  ];
}

function converted(
  workspace: ModelWorkspace,
  args: ImportArguments,
  imported: ConvertedModel,
): Either.Either<ImportResult, readonly string[]> {
  return pipe(
    confined(workspace, args.target),
    Either.mapLeft(renderWorkspaceFailure),
    Either.flatMap((path) => targeted(workspace, path, args, imported)),
  );
}

function targeted(
  workspace: ModelWorkspace,
  path: string,
  args: ImportArguments,
  imported: ConvertedModel,
): Either.Either<ImportResult, readonly string[]> {
  const file = withinRoot(workspace, path);
  return pipe(
    serialized(file, () => saerskrivenYamlCodec.write(imported.model)),
    Either.flatMap((written) =>
      Either.map(
        createdFile({ file, path }, written.output),
        (revision): ImportResult => ({
          file,
          format: 'saerskriven-yaml',
          revision,
          divergences: [...imported.divergences, ...written.divergences],
          source: { file: args.file, format: imported.format },
        }),
      ),
    ),
    Either.mapLeft(renderWriteFailure),
  );
}
