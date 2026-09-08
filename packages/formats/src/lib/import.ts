import { parseModel, toParseIssues, type Model } from '@saerskriven/model';
import { otmWireSchema } from '@saerskriven/wire-otm';
import { tmbomWireSchema } from '@saerskriven/wire-tmbom';
import { Either } from 'effect';
import { z } from 'zod';
import { ReadFailure } from './codec.js';
import type { Divergence } from './divergence.js';
import { mapOtm } from './otm-import.js';
import { mapTmbom } from './tmbom-import.js';
import { parseYaml } from './parse-yaml.js';
import { isRecord } from './records.js';
import { undeclaredDivergences } from './undeclared.js';

/** Formats accepted by conversion into a new native model. */
export const importFormatSchema = z.enum(['otm', 'tmbom']);
/** An import format has no implied write capability. */
export type ImportFormat = z.infer<typeof importFormatSchema>;

/** A conversion deliberately retains no source document for later saves. */
export type ImportResult = {
  readonly format: ImportFormat;
  readonly model: Model;
  readonly divergences: readonly Divergence[];
};

/** Validates a complete OTM or TM-BOM document and converts it into a native model. */
export function importModel(
  text: string,
): Either.Either<ImportResult, ReadFailure> {
  return Either.flatMap(
    parseYaml(text),
    (given): Either.Either<ImportResult, ReadFailure> => {
      if (
        !isRecord(given) ||
        (!Object.hasOwn(given, 'otmVersion') &&
          !Object.hasOwn(given, '$schema'))
      ) {
        return Either.left(
          ReadFailure.InvalidWireDocument({
            issues: [
              {
                path: [],
                code: 'invalid_format',
                message:
                  'Import requires an OTM 0.2.0 version stamp or a TM-BOM 1.0.1 or 1.0.2 schema URI.',
              },
            ],
          }),
        );
      }
      const format =
        isRecord(given) && Object.hasOwn(given, 'otmVersion') ? 'otm' : 'tmbom';
      const parsed =
        format === 'otm'
          ? otmWireSchema.safeParse(given)
          : tmbomWireSchema.safeParse(given);
      if (!parsed.success)
        return Either.left(
          ReadFailure.InvalidWireDocument({
            issues: toParseIssues(parsed.error.issues),
          }),
        );
      const source = parsed.data;
      const mapped = 'otmVersion' in source ? mapOtm(source) : mapTmbom(source);
      if (mapped.context.issues.length > 0)
        return Either.left(
          ReadFailure.InvalidWireDocument({ issues: mapped.context.issues }),
        );
      return Either.mapBoth(parseModel(mapped.input), {
        onLeft: (failure) =>
          ReadFailure.InvalidModel({ issues: failure.issues }),
        onRight: (model) => ({
          format,
          model,
          divergences: [
            ...undeclaredDivergences(given, source),
            ...mapped.context.divergences,
          ],
        }),
      });
    },
  );
}
