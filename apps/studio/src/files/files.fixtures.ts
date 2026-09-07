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

/**
 * A file this repository commits, named by its path from the root, as the
 * bridge would hand it over: the bytes on disk and the size of them, so a
 * spec exercises the same bound a browser would.
 */
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
  readonly blob?: Blob;
  readonly elsewhere: boolean;
};

/** How many times a bridge was told to forget the file it was holding. */
export type Releases = { count: number };

/**
 * A bridge whose answers a spec decides, and whose writes, offers and
 * releases it reads back. `offered` holds the formats each save-as put in
 * front of the person, in the order they were offered.
 */
export type SpecBridge = FileBridge & {
  readonly writes: readonly Recorded[];
  readonly offered: readonly (readonly SaveFileType[])[];
  readonly releases: Releases;
};

/**
 * What a {@link specBridge} answers: the file its picker hands over, the name
 * a save picker answers with, whether it has pickers at all, and what a write
 * answers. The defaults are the ordinary path: a picker that offers nothing
 * is one the person dismissed, a save picker answers with the name it was
 * pointed at, and a write lands where it was pointed.
 */
export type SpecBridgeOptions = {
  readonly offers?: ChosenFile;
  readonly chooses?: string;
  readonly picker?: boolean;
  readonly save?: SaveOutcome;
};

/**
 * The bridge a spec drives, standing in for a browser without one. It reads
 * a file through the same bound check every bridge reads one through, so a
 * spec of the open path is a spec of the path a browser takes.
 */
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
        blob: content instanceof Blob ? content : undefined,
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
