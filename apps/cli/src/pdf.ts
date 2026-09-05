import {
  initSync,
  TypstCompilerBuilder,
} from '@myriaddreamin/typst-ts-web-compiler';
import { Either } from 'effect';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reasonOf } from './files.js';

const wasmModule = 'typst_ts_web_compiler_bg.wasm';

const fontFile = /\.ttf$/u;

const mainFile = '/main.typ';

const noDiagnostics = 0;

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
 * The compiler is the Typst WebAssembly build, given no access model, so it
 * has no filesystem and no package registry: the source has to carry
 * everything it draws, which is what `renderTypst` writes. The fonts are
 * every `.ttf` in `assets`, in name order, loaded into the compiler in
 * memory; nothing is read from the host's font directories, so the same
 * source gives the same PDF on every machine.
 *
 * Nothing here throws. The WebAssembly module reports a compile failure by
 * throwing a value that is no Error, and a missing asset is a broken install
 * rather than a bad model file, so both come back on the left as a sentence
 * for a user to read.
 */
export async function compilePdf(
  source: string,
  assets: string,
): Promise<Either.Either<Uint8Array, string>> {
  try {
    const compiler = await compilerWith(assets);
    compiler.add_source(mainFile, source);
    const artifact: unknown = compiler.compile(
      mainFile,
      null,
      'pdf',
      noDiagnostics,
    );
    return artifact instanceof Uint8Array
      ? Either.right(artifact)
      : Either.left('the Typst compiler produced no PDF');
  } catch (error) {
    return Either.left(`cannot compile the PDF: ${reasonOf(error)}`);
  }
}

async function compilerWith(assets: string) {
  initSync({ module: readFileSync(join(assets, wasmModule)) });
  const builder = new TypstCompilerBuilder();
  builder.set_dummy_access_model();
  for (const font of fontsIn(assets)) {
    await builder.add_raw_font(new Uint8Array(readFileSync(font)));
  }
  return builder.build();
}

function fontsIn(assets: string): readonly string[] {
  const names = readdirSync(assets).filter((name) => fontFile.test(name));
  names.sort();
  return names.map((name) => join(assets, name));
}
