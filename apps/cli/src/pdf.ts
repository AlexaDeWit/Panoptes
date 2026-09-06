import {
  compilePdf as compileTypst,
  type PdfAssets,
} from '@panoptes/render/pdf';
import { Either } from 'effect';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reasonOf } from './files.js';

const wasmModule = 'typst_ts_web_compiler_bg.wasm';

const fontFile = /\.ttf$/u;

const loaded = new Map<string, PdfAssets>();

/**
 * Where the executable carries what the PDF path reads: the Typst
 * WebAssembly module and the fonts, beside the bundle rather than beside the
 * sources, because `deno compile --include` puts that directory into the
 * executable and `import.meta.dirname` is how the code inside one reaches it.
 */
export const typstAssets = join(import.meta.dirname, 'assets');

/**
 * Typst source compiled to a PDF, or a sentence saying why it was not.
 *
 * Finding the bytes is this side's work and typesetting them is
 * `@panoptes/render/pdf`'s. The module and every `.ttf` in `assets`, in name
 * order, are read here and handed over, so nothing is read from the host's
 * font directories and the same source gives the same PDF on every machine.
 * A directory missing them is a broken install rather than a bad model file,
 * so it comes back on the left in the sentence a refused document comes back
 * in.
 *
 * What a directory holds is read once per process. That spares a second
 * compile the 28 MB WebAssembly module, and it is what lets the subpath's
 * guard see that the process has already started from these bytes.
 */
export function compilePdf(
  source: string,
  assets: string,
): Promise<Either.Either<Uint8Array, string>> {
  return Either.match(bytesIn(assets), {
    onLeft: (reason) =>
      Promise.resolve(Either.left(`cannot compile the PDF: ${reason}`)),
    onRight: (found) => compileTypst(source, found),
  });
}

function bytesIn(assets: string): Either.Either<PdfAssets, string> {
  const known = loaded.get(assets);
  return known === undefined ? readAssets(assets) : Either.right(known);
}

function readAssets(assets: string): Either.Either<PdfAssets, string> {
  const found = Either.try({
    try: (): PdfAssets => ({
      wasm: readFileSync(join(assets, wasmModule)),
      fonts: fontsIn(assets).map((font) => new Uint8Array(readFileSync(font))),
    }),
    catch: reasonOf,
  });
  if (Either.isRight(found)) {
    loaded.set(assets, found.right);
  }
  return found;
}

function fontsIn(assets: string): readonly string[] {
  const names = readdirSync(assets).filter((name) => fontFile.test(name));
  names.sort();
  return names.map((name) => join(assets, name));
}
