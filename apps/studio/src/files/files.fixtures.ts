import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  OpenOutcome,
  SaveOutcome,
  readWithin,
  type ChosenFile,
  type FileContent,
  type FileBridge,
  type SaveFileType,
} from './bridge.js';

/** A file a spec hands to a bridge, standing in for a browser `File`. */
export function chosenFile(name: string, text: string): ChosenFile {
  return {
    name,
    size: Buffer.byteLength(text, 'utf8'),
    text: () => Promise.resolve(text),
  };
}

/** A browser file handle whose writes and completion a spec controls. */
export const handleFor = (
  name: string,
  text: string,
  written: FileContent[],
  close: () => Promise<void> = () => Promise.resolve(),
) => ({
  name,
  getFile: () => Promise.resolve(chosenFile(name, text)),
  createWritable: () =>
    Promise.resolve({
      write: (chunk: FileContent) => {
        written.push(chunk);
        return Promise.resolve();
      },
      close,
    }),
});

/** A committed file with its on-disk byte count, addressed from the repository root. */
export function vendoredFile(path: string): ChosenFile {
  const full = join(import.meta.dirname, '../../../..', path);
  const text = readFileSync(full, 'utf8');
  return {
    name: path.split('/').at(-1) ?? path,
    size: statSync(full).size,
    text: () => Promise.resolve(text),
  };
}

/** One text a bridge was asked to write, and whether it was asked where. */
export type Recorded = {
  readonly name: string;
  readonly text: string;
  readonly bytes?: Uint8Array;
  readonly elsewhere: boolean;
};

/** How many times a bridge was told to forget the file it was holding. */
export type Releases = { count: number };

/** A bridge recording writes, picker offers in order, and releases. */
export type SpecBridge = FileBridge & {
  readonly writes: readonly Recorded[];
  readonly offered: readonly (readonly SaveFileType[])[];
  readonly releases: Releases;
};

/** Defaults cancel opening and write to the proposed name. */
export type SpecBridgeOptions = {
  readonly offers?: ChosenFile;
  readonly chooses?: string;
  readonly picker?: boolean;
  readonly save?: SaveOutcome;
};

/** Reads through the production size bound and records the requested writes. */
export function specBridge(options: SpecBridgeOptions = {}): SpecBridge {
  const writes: Recorded[] = [];
  const offered: (readonly SaveFileType[])[] = [];
  const releases: Releases = { count: 0 };

  const opened = (maxBytes: number): Promise<OpenOutcome> => {
    if (options.picker === false) {
      return Promise.resolve(OpenOutcome.NoPicker());
    }
    return options.offers === undefined
      ? Promise.resolve(OpenOutcome.Cancelled())
      : readWithin(options.offers, maxBytes);
  };

  const answer = (
    name: string,
    content: FileContent,
    elsewhere: boolean,
  ): Promise<SaveOutcome> => {
    const outcome = options.save ?? SaveOutcome.Written({ name });
    if (SaveOutcome.$is('Written')(outcome)) {
      writes.push({
        name: outcome.name,
        text: typeof content === 'string' ? content : '',
        bytes: typeof content === 'string' ? undefined : content,
        elsewhere,
      });
    }
    return Promise.resolve(outcome);
  };

  return {
    writes,
    offered,
    releases,
    open: opened,
    received: (file, maxBytes) => readWithin(file, maxBytes),
    save: (name, text) => answer(name, text, false),
    saveAs: (name, types, text) => {
      offered.push(types);
      const chosen =
        options.picker === false ? name : (options.chooses ?? name);
      return answer(chosen, text(chosen), true);
    },
    exportFile: (name, type, content) => {
      offered.push([type]);
      const chosen =
        options.picker === false ? name : (options.chooses ?? name);
      return answer(chosen, content, true);
    },
    asksWhere: () => options.picker !== false,
    release: () => {
      releases.count += 1;
    },
  };
}
