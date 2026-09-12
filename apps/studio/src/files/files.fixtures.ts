import { renderSvg } from '@saerskriven/render';
import { Either } from 'effect';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  OpenOutcome,
  SaveOutcome,
  fileOwnership,
  readWithin,
  type ChosenFile,
  type FileContent,
  type FileBridge,
  type FileResult,
  type SaveFileType,
} from './bridge.js';
import type { RenderExports } from './export-commands.js';

/**
 * The bytes a PNG file opens with, so a spec can tell one from other content
 * without reading the whole file.
 */
export const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Render services that answer without WebAssembly, one field at a time
 * replaceable by the spec that is about that field.
 */
export function specRenders(
  overrides: Partial<RenderExports> = {},
): RenderExports {
  const assets = { wasm: new Uint8Array(), fonts: [] };
  return {
    pdfAssets: () => Promise.resolve(Either.right(assets)),
    compile: () => Promise.resolve(Either.right(new Uint8Array([37, 80]))),
    pngAssets: () => Promise.resolve(Either.right(assets)),
    draw: (diagram, model) =>
      Promise.resolve(
        Either.right({
          png: pngSignature,
          width: 2,
          height: 1,
          unplaced: renderSvg(diagram, model).unplaced,
        }),
      ),
    ...overrides,
  };
}

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

/** A promise whose result a spec supplies after starting concurrent operations. */
export function deferred<Value>() {
  let resolveValue: ((value: Value) => void) | undefined;
  let rejectValue: ((reason: Error) => void) | undefined;
  const promise = new Promise<Value>((resolve, reject) => {
    resolveValue = resolve;
    rejectValue = reject;
  });
  return {
    promise,
    resolve: (value: Value): void => {
      resolveValue?.(value);
    },
    reject: (reason: Error): void => {
      rejectValue?.(reason);
    },
  };
}

/** Settles a bridge outcome without codec validation for platform-level specs. */
export async function settled<Outcome extends OpenOutcome | SaveOutcome>(
  pending: Promise<FileResult<Outcome>>,
): Promise<Outcome> {
  const result = await pending;
  result.settle(
    result.outcome._tag !== 'TooLarge' && result.outcome._tag !== 'Unreadable',
  );
  return result.outcome;
}

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
  const ownership = fileOwnership<never>();
  const writes: Recorded[] = [];
  const offered: (readonly SaveFileType[])[] = [];
  const releases: Releases = { count: 0 };

  const request = async <Outcome>(
    work: () => Promise<Outcome>,
  ): Promise<FileResult<Outcome>> => {
    const complete = ownership.begin();
    return complete(await work(), undefined);
  };

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
    open: (maxBytes) => request(() => opened(maxBytes)),
    received: (file, maxBytes) => request(() => readWithin(file, maxBytes)),
    save: (name, text) => request(() => answer(name, text, false)),
    saveAs: (name, types, text) =>
      request(() => {
        offered.push(types);
        const chosen =
          options.picker === false ? name : (options.chooses ?? name);
        return answer(chosen, text(chosen), true);
      }),
    exportFile: (name, type, content) => {
      offered.push([type]);
      const chosen =
        options.picker === false ? name : (options.chooses ?? name);
      return answer(chosen, content, true);
    },
    asksWhere: () => options.picker !== false,
    release: () => {
      ownership.release();
      releases.count += 1;
    },
  };
}
