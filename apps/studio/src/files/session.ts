import {
  escapedForTerminal,
  importModel,
  ReadFailure,
  formatNameSchema,
  hasDiverged,
  saerskrivenYamlCodec,
  readAnyFormat,
  renderDivergences,
  threatDragonCodec,
  type DetectedRead,
  type Divergence,
  type FormatName,
  type WriteResult,
} from '@saerskriven/formats';
import type { Model } from '@saerskriven/model';
import { Either } from 'effect';
import { Action } from '../store/actions.js';
import {
  FileLifecycle,
  untitledModel,
  type RetainedSource,
} from '../store/state.js';
import { OpenOutcome, SaveOutcome, type SaveFileType } from './bridge.js';

type FormatFile = {
  readonly label: string;
  readonly mediaType: string;
  readonly extensions: readonly string[];
};

/** The first extension is proposed for saving, and every listed extension identifies the format. */
export const formatFiles = {
  'threat-dragon': {
    label: 'Threat Dragon JSON',
    mediaType: 'application/json',
    extensions: ['.json'],
  },
  'saerskriven-yaml': {
    label: 'Saerskriven YAML',
    mediaType: 'application/yaml',
    extensions: ['.yaml', '.yml'],
  },
} as const satisfies Record<FormatName, FormatFile>;

/** The default format holds the full internal model. */
export const nativeFormat: FormatName = 'saerskriven-yaml';

/** The name a model with no file of its own is proposed under. */
export const unnamedModel = 'threat-model';

/** Uses the placeholder model title when no file is open. */
export function nameOf(file: FileLifecycle): string {
  return FileLifecycle.$match(file, {
    NoFile: () => untitledModel,
    Opened: ({ name }) => name,
  });
}

/** Which format the open file is in, and the native one while there is none. */
export function formatOf(file: FileLifecycle): FormatName {
  return FileLifecycle.$match(file, {
    NoFile: () => nativeFormat,
    Opened: ({ source }) => source.format,
  });
}

/** Offers every registered format with the current format first. */
export function formatsFrom(format: FormatName): readonly FormatName[] {
  return [
    format,
    ...formatNameSchema.options.filter((option) => option !== format),
  ];
}

/** Describes the supplied formats for a platform picker. */
export function saveTypes(
  formats: readonly FormatName[],
): readonly SaveFileType[] {
  return formats.map((option) => ({
    description: formatFiles[option].label,
    accept: { [formatFiles[option].mediaType]: formatFiles[option].extensions },
  }));
}

/** The chosen file extension determines the write codec. */
export function formatOfName(name: string): FormatName | undefined {
  const written = name.toLowerCase();
  return formatNameSchema.options.find((option) =>
    formatFiles[option].extensions.some((extension) =>
      written.endsWith(extension),
    ),
  );
}

/** Replaces the extension and supplies a stem when the name has none. */
export function proposedName(name: string, format: FormatName): string {
  return withExtension(name, formatFiles[format].extensions[0], unnamedModel);
}

/** The proposed export name, derived from the open file or `Untitled`. */
export function proposedExportName(
  file: FileLifecycle,
  extension: string,
): string {
  return withExtension(nameOf(file), extension, untitledModel);
}

function withExtension(
  name: string,
  extension: string,
  fallback: string,
): string {
  const stem = name.replace(/\.[^./\\]*$/u, '').trim();
  return `${stem === '' ? fallback : stem}${extension}`;
}

/** Where a save writes, and the document it merges the model onto. */
export type SaveTarget = {
  readonly name: string;
  readonly source: RetainedSource;
};

/** Same-format saves retain the source document for merging. Other formats project the model. */
export function saveTarget(
  file: FileLifecycle,
  format: FormatName,
): SaveTarget {
  return FileLifecycle.$match(file, {
    NoFile: () => ({
      name: proposedName(unnamedModel, format),
      source: { format, document: undefined },
    }),
    Opened: ({ name, source }) =>
      source.format === format
        ? { name, source }
        : {
            name: proposedName(name, format),
            source: { format, document: undefined },
          },
  });
}

/** Pairs each retained document with the codec for its format. */
export function writeThrough(
  model: Model,
  source: RetainedSource,
): WriteResult {
  return source.format === 'threat-dragon'
    ? threatDragonCodec.write(model, source.document)
    : saerskrivenYamlCodec.write(model, source.document);
}

/** The selected read operation determines whether the source remains a save target. */
export type ReadIntent = 'open' | 'import';

/** Cancellation produces no action. Import refuses without changing the current file. */
export function openedBy(
  outcome: OpenOutcome,
  intent: ReadIntent = 'open',
): Action | undefined {
  const failed = intent === 'import' ? Action.ImportFailed : Action.ReadFailed;
  return OpenOutcome.$match(outcome, {
    Chosen: ({ name, text }) =>
      intent === 'import'
        ? actionForImport(name, text)
        : actionForText(name, text),
    TooLarge: ({ name, bound, observed }) =>
      failed({
        name,
        failure: ReadFailure.ExceededReadLimit({
          limit: 'maxTextBytes',
          bound,
          observed,
        }),
      }),
    Unreadable: ({ reason }) =>
      Action.FileRefused({ operation: intent, reason }),
    Cancelled: () => undefined,
    NoPicker: () => undefined,
  });
}

/** Uses the written name and identifies save refusals so the existing file remains available for retry. */
export function savedBy(
  outcome: SaveOutcome,
  source: RetainedSource,
): Action | undefined {
  return SaveOutcome.$match(outcome, {
    Written: ({ name }) => Action.Saved({ name, source }),
    Cancelled: () => undefined,
    Refused: ({ reason }) => Action.FileRefused({ operation: 'save', reason }),
  });
}

/** Uses the codec renderer to escape foreign identifiers and format divergences. */
export function reportLines(
  divergences: readonly Divergence[],
  occasion?: LossOccasion,
): readonly string[] {
  if (occasion === 'import')
    return divergences.map(({ detail }) => escapedForTerminal(detail));
  return hasDiverged(divergences)
    ? renderDivergences(divergences).split('\n')
    : [];
}

/** Whether a loss report is about a file being read or one being written. */
export type LossOccasion = 'open' | 'save' | 'import';

/** What one open or one save cost, and which of the two it was. */
export type LossReport = {
  readonly occasion: LossOccasion;
  readonly divergences: readonly Divergence[];
};

/** How each occasion introduces its report to a person. */
export const reportHeadlines: Record<LossOccasion, string> = {
  open: 'Opening the file dropped what it holds and Saerskriven does not:',
  import: 'Import created a native model with these conversions and omissions:',
  save: 'The last save did not carry everything the model holds:',
};

/** Reports losses from reading, including fields absent from the retained document. */
export function openReport(
  divergences: readonly Divergence[],
  occasion: ReadIntent = 'open',
): LossReport | undefined {
  return reported(occasion, divergences);
}

/** What a save cost, and nothing at all where it carried everything. */
export function saveReport(
  divergences: readonly Divergence[],
): LossReport | undefined {
  return reported('save', divergences);
}

/** Preserves the pairing between the detected format and its retained document. */
export function retainedSource(read: DetectedRead): RetainedSource {
  return read.format === 'threat-dragon'
    ? { format: 'threat-dragon', document: read.source }
    : { format: 'saerskriven-yaml', document: read.source };
}

function reported(
  occasion: LossOccasion,
  divergences: readonly Divergence[],
): LossReport | undefined {
  return hasDiverged(divergences) ? { occasion, divergences } : undefined;
}

function actionForText(name: string, text: string): Action {
  return Either.match(readAnyFormat(text), {
    onLeft: (failure) => Action.ReadFailed({ name, failure }),
    onRight: (read) =>
      Action.Opened({
        model: read.model,
        name,
        source: retainedSource(read),
        divergences: read.divergences,
      }),
  });
}

function actionForImport(name: string, text: string): Action {
  return Either.match(importModel(text), {
    onLeft: (failure) => Action.ImportFailed({ name, failure }),
    onRight: ({ model, divergences }) =>
      Action.Imported({
        model,
        name: proposedName(name, nativeFormat),
        divergences,
      }),
  });
}
