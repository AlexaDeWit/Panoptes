import {
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

/**
 * How each registered format appears as a file: the words a person reads,
 * the media type a picker files it under, and the extensions it is written
 * with. The first extension is the one a save proposes, and any of them
 * names the format back when a picker answers with a file a person named.
 */
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

/**
 * The format a model with no file of its own is saved in: the native one,
 * which holds the whole model and so loses nothing on the way out.
 */
export const nativeFormat: FormatName = 'saerskriven-yaml';

/** The name a model with no file of its own is proposed under. */
export const unnamedModel = 'threat-model';

/**
 * What the open file is called, and what a model that lives in none is
 * called: the same word the model itself carries as its title and the tab
 * shows, rather than a second way of saying there is no file.
 */
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

/**
 * The formats a save-as offers, the file's own first, which is the one it
 * proposes. It reads the registry rather than naming formats, so a third
 * codec is offered rather than left out.
 */
export function formatsFrom(format: FormatName): readonly FormatName[] {
  return [
    format,
    ...formatNameSchema.options.filter((option) => option !== format),
  ];
}

/**
 * The formats as a save picker offers them. A picker is handed every format
 * so the person names the file in whichever they mean, and a platform with
 * no picker is handed the one the studio asked for itself.
 */
export function saveTypes(
  formats: readonly FormatName[],
): readonly SaveFileType[] {
  return formats.map((option) => ({
    description: formatFiles[option].label,
    accept: { [formatFiles[option].mediaType]: formatFiles[option].extensions },
  }));
}

/**
 * The format a file name is written in, and nothing at all where its
 * extension names none. A picker answers with the name the person settled
 * on, which is what says which codec writes the file, so this is the one
 * place an extension is read as a format.
 */
export function formatOfName(name: string): FormatName | undefined {
  const written = name.toLowerCase();
  return formatNameSchema.options.find((option) =>
    formatFiles[option].extensions.some((extension) =>
      written.endsWith(extension),
    ),
  );
}

/**
 * The name a save proposes: the one the model already lives under, carrying
 * the target format's extension. A name that is all extension, or none at
 * all, falls back to a name rather than proposing a file with no stem.
 */
export function proposedName(name: string, format: FormatName): string {
  const stem = name.replace(/\.[^./\\]*$/u, '').trim();
  return `${stem === '' ? unnamedModel : stem}${formatFiles[format].extensions[0]}`;
}

/** Where a save writes, and the document it merges the model onto. */
export type SaveTarget = {
  readonly name: string;
  readonly source: RetainedSource;
};

/**
 * The file a save writes to. Saving in the format the model was read from
 * writes back to the same name and merges onto the document that read
 * retained, which is what carries the parts of the file Saerskriven does not
 * model. Saving in any other format has nothing to merge onto, so the codec
 * projects the model and reports what the format cannot hold.
 */
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

/**
 * The text a save writes, and where that text and the model do not
 * correspond. Narrowing on the format the source names is what pairs a
 * document with the codec that produced it, so nothing here asserts which
 * codec owns which document, and a format with no arm of its own would not
 * compile rather than writing through the wrong codec.
 */
export function writeThrough(
  model: Model,
  source: RetainedSource,
): WriteResult {
  return source.format === 'threat-dragon'
    ? threatDragonCodec.write(model, source.document)
    : saerskrivenYamlCodec.write(model, source.document);
}

/**
 * The action an open answers with, and nothing at all where there is nothing
 * to record: a dismissed picker, and a bridge asking the caller to open
 * through its own file input. A file past the read bound is reported as the
 * codecs report it, so one wording serves a bound the studio enforced and a
 * bound a codec did.
 */
export function openedBy(outcome: OpenOutcome): Action | undefined {
  return OpenOutcome.$match(outcome, {
    Chosen: ({ name, text }) => actionForText(name, text),
    TooLarge: ({ name, bound, observed }) =>
      Action.ReadFailed({
        name,
        failure: ReadFailure.ExceededReadLimit({
          limit: 'maxTextBytes',
          bound,
          observed,
        }),
      }),
    Unreadable: ({ reason }) => Action.FileRefused({ reason }),
    Cancelled: () => undefined,
    NoPicker: () => undefined,
  });
}

/**
 * The action a save answers with, carrying the source a later save merges
 * onto, and nothing at all where the person dismissed the picker. The name
 * comes from the outcome rather than from the target, because a picker is
 * free to write somewhere other than where it was pointed.
 */
export function savedBy(
  outcome: SaveOutcome,
  source: RetainedSource,
): Action | undefined {
  return SaveOutcome.$match(outcome, {
    Written: ({ name }) => Action.Saved({ name, source }),
    Cancelled: () => undefined,
    Refused: ({ reason }) => Action.FileRefused({ reason }),
  });
}

/**
 * The loss report, one line per divergence, through the formats package's
 * own rendering: an id reaches it as a foreign file wrote it, and that
 * rendering is where the escaping lives. An aligned read or write reports
 * nothing, which is a list of no lines rather than a line saying so.
 */
export function reportLines(
  divergences: readonly Divergence[],
): readonly string[] {
  return hasDiverged(divergences)
    ? renderDivergences(divergences).split('\n')
    : [];
}

/** Whether a loss report is about a file being read or one being written. */
export type LossOccasion = 'open' | 'save';

/** What one open or one save cost, and which of the two it was. */
export type LossReport = {
  readonly occasion: LossOccasion;
  readonly divergences: readonly Divergence[];
};

/** How each occasion introduces its report to a person. */
export const reportHeadlines: Record<LossOccasion, string> = {
  open: 'Opening the file dropped what it holds and Saerskriven does not:',
  save: 'The last save did not carry everything the model holds:',
};

/**
 * What an open cost, and nothing at all where it cost nothing. A read drops
 * every key its wire schema does not declare and reports each one, and the
 * retained document has lost them too, so the save that follows has nothing
 * left to say about them: this is the only place they are said.
 */
export function openReport(
  divergences: readonly Divergence[],
): LossReport | undefined {
  return reported('open', divergences);
}

/** What a save cost, and nothing at all where it carried everything. */
export function saveReport(
  divergences: readonly Divergence[],
): LossReport | undefined {
  return reported('save', divergences);
}

/**
 * What a read produced, as the store holds it. Narrowing the format is what
 * pairs the document with the codec that produced it, so a format with no
 * arm of its own would not compile rather than filing its document under
 * another codec's name.
 */
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
