import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  OpenOutcome,
  SaveOutcome,
  readWithin,
  type ChosenFile,
  type FileBridge,
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
  readonly elsewhere: boolean;
};

/** A bridge whose answers a spec decides, and whose writes it reads back. */
export type SpecBridge = FileBridge & { readonly writes: readonly Recorded[] };

/**
 * What a {@link specBridge} answers: the file its picker hands over, whether
 * it has a picker at all, and what a write answers. The defaults are the
 * ordinary path: a picker that offers nothing is one the person dismissed,
 * and a write lands where it was pointed.
 */
export type SpecBridgeOptions = {
  readonly offers?: ChosenFile;
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

  const offered = (maxBytes: number): Promise<OpenOutcome> => {
    if (options.picker === false) {
      return Promise.resolve(OpenOutcome.NoPicker());
    }
    return options.offers === undefined
      ? Promise.resolve(OpenOutcome.Cancelled())
      : readWithin(options.offers, maxBytes);
  };

  const answer = (
    name: string,
    text: string,
    elsewhere: boolean,
  ): Promise<SaveOutcome> => {
    const outcome = options.save ?? SaveOutcome.Written({ name });
    if (SaveOutcome.$is('Written')(outcome)) {
      writes.push({ name: outcome.name, text, elsewhere });
    }
    return Promise.resolve(outcome);
  };

  return {
    writes,
    open: offered,
    received: (file, maxBytes) => readWithin(file, maxBytes),
    save: (name, text) => answer(name, text, false),
    saveAs: (name, text) => answer(name, text, true),
  };
}
