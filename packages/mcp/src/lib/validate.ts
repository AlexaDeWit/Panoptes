import {
  divergenceSchema,
  hasDiverged,
  renderDivergences,
} from '@saerskriven/formats';
import { Either } from 'effect';
import { z } from 'zod';
import { fileArgumentSchema } from './inspect.js';
import {
  readNamed,
  readingSchema,
  renderReading,
  reportedReading,
} from './reading.js';
import type { ModelWorkspace } from './workspace.js';

/** What `saer_validate` takes. */
export type ValidateArguments = z.infer<typeof fileArgumentSchema>;

/** What `saer_validate` answers with. */
export const validateResultSchema = readingSchema.extend({
  diverged: z.boolean(),
  divergences: z.array(divergenceSchema),
});

/** What `saer_validate` answers with. */
export type ValidateResult = z.infer<typeof validateResultSchema>;

/** What `saer_validate` tells a client it is for. */
export const validateDescription = [
  'Check whether one file reads as a Saerskriven threat model, and report every place the file and the model do not correspond exactly. The file name is never consulted: the content decides which format claims it, so a model saved under any extension reads.',
  'Call this on a file you did not write, before you work from it, and after an edit by another tool to confirm the file still reads. Use saer_inspect where you also want what the model holds, since this tool reports only whether the file reads and what it lost on the way.',
  'Pass `file` as a path relative to the server root, or leave it out where the server was started with a default model. This tool takes no other argument.',
  'A file no format claims, or one a format claims and refuses, comes back as an error result: it names the formats that were tried, or the path inside the document of every issue the schema raised, down to the field. A file that reads is not a file that corresponds exactly, so read the divergences of a successful result too. This tool never writes.',
].join(' ');

/**
 * Whether the file reads and what it lost on the way, or the lines saying
 * why it did not read. The refusal is the codec's own, path-precise where a
 * schema refused a field, which is what {@link readNamed} already words for
 * every read tool.
 */
export function validate(
  workspace: ModelWorkspace,
  args: ValidateArguments,
): Either.Either<ValidateResult, readonly string[]> {
  return Either.map(readNamed(workspace, args.file), (reading) => ({
    ...reportedReading(reading),
    diverged: hasDiverged(reading.divergences),
    divergences: [...reading.divergences],
  }));
}

/** The check as the lines its text result carries. */
export function renderValidation(result: ValidateResult): readonly string[] {
  return [
    ...renderReading(result),
    `reads: yes, as ${result.format}`,
    'divergences:',
    renderDivergences(result.divergences),
  ];
}
