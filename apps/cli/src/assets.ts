import { ledBy } from '@saerskriven/render/png';
import { Either } from 'effect';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reasonOf } from './files.js';

const fontFile = /\.ttf$/u;

const loaded = new Map<string, WasmAssets>();

/**
 * Where the executable carries what a projection reads: the WebAssembly
 * modules and the fonts, beside the bundle rather than beside the sources,
 * because `deno compile --include` puts that directory into the executable
 * and `import.meta.dirname` is how the code inside one reaches it.
 */
export const runtimeAssets = join(import.meta.dirname, 'assets');

/**
 * The bytes a Typst compile or a rasterization runs on: one WebAssembly
 * module, and the faces to set text in.
 */
export type WasmAssets = {
  readonly wasm: Uint8Array;
  readonly fonts: readonly Uint8Array[];
};

/**
 * The module named `wasmModule` in `directory` and every `.ttf` beside it, so
 * the faces are the ones the build carried and the host's own font
 * directories are never consulted.
 *
 * The faces come back in name order, except that `leading` names one to put
 * first. A renderer that falls a family no face carries back to the family of
 * the first face it was offered needs that, and a compiler that resolves
 * families by name does not, so only the caller that needs it asks. Whether a
 * directory holding no such face is refused or reordered as far as it can be
 * is for `ledBy` on the `png` subpath to decide, here and in the studio
 * alike.
 *
 * A directory holding no face at all is refused for the same reason, since a
 * compiler and a renderer both accept an empty list and both then write a
 * document with every shape drawn and no text in it.
 *
 * A directory that reads clean is read once per process, module and order.
 * That spares a second projection the WebAssembly bytes, and it is what lets
 * the PDF subpath's guard see that the process has already started from
 * them. A refused directory is re-read on every call, since nothing about the
 * refusal is worth remembering.
 */
export function wasmAssets(
  directory: string,
  wasmModule: string,
  leading?: string,
): Either.Either<WasmAssets, string> {
  const key = `${directory}\0${wasmModule}\0${leading ?? ''}`;
  const known = loaded.get(key);
  return known === undefined
    ? read(key, directory, wasmModule, leading)
    : Either.right(known);
}

function read(
  key: string,
  directory: string,
  wasmModule: string,
  leading: string | undefined,
): Either.Either<WasmAssets, string> {
  const found = Either.flatMap(
    Either.try({
      try: () => ({
        wasm: readFileSync(join(directory, wasmModule)),
        faces: facesIn(directory),
      }),
      catch: reasonOf,
    }),
    (listed) => lettered(listed, directory, leading),
  );
  if (Either.isRight(found)) {
    loaded.set(key, found.right);
  }
  return found;
}

function lettered(
  listed: { readonly wasm: Uint8Array; readonly faces: readonly string[] },
  directory: string,
  leading: string | undefined,
): Either.Either<WasmAssets, string> {
  return Either.flatMap(offered(listed.faces, directory, leading), (faces) =>
    Either.try({
      try: (): WasmAssets => ({
        wasm: listed.wasm,
        fonts: faces.map(
          (face) => new Uint8Array(readFileSync(join(directory, face))),
        ),
      }),
      catch: reasonOf,
    }),
  );
}

function offered(
  faces: readonly string[],
  directory: string,
  leading: string | undefined,
): Either.Either<readonly string[], string> {
  if (faces.length === 0) {
    return Either.left(`${directory} holds no .ttf font face`);
  }
  return leading === undefined
    ? Either.right(faces)
    : ledBy(faces, (face) => face, leading, directory);
}

function facesIn(directory: string): readonly string[] {
  const names = readdirSync(directory).filter((name) => fontFile.test(name));
  names.sort();
  return names;
}
