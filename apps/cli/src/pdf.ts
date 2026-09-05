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

const diagnosticMessages = /\bmessage:\s*"((?:[^"\\]|\\.)*)"/gu;

const diagnosticHints = /\bhints:\s*\[([^\]]*)\]/gu;

const quotedHint = /"((?:[^"\\]|\\.)*)"/gu;

const debugEscape = /\\(.)/gu;

const runsOfSpace = /\s+/gu;

let startedFrom: string | undefined;

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
 * throwing a string holding Rust's own debug rendering of its diagnostics,
 * and a missing asset is a broken install rather than a bad model file, so
 * both come back on the left as a sentence for a user to read. What that
 * rendering carries and a user needs is the message and the hints; the byte
 * offsets and the empty traces beside them are not, and a rendering this
 * does not recognize is reported as it stands rather than swallowed.
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
    return Either.left(`cannot compile the PDF: ${refusalOf(error)}`);
  }
}

async function compilerWith(assets: string) {
  started(assets);
  const builder = new TypstCompilerBuilder();
  builder.set_dummy_access_model();
  for (const font of fontsIn(assets)) {
    await builder.add_raw_font(new Uint8Array(readFileSync(font)));
  }
  return builder.build();
}

function started(assets: string): void {
  if (startedFrom === assets) {
    return;
  }
  initSync({ module: readFileSync(join(assets, wasmModule)) });
  startedFrom = assets;
}

function fontsIn(assets: string): readonly string[] {
  const names = readdirSync(assets).filter((name) => fontFile.test(name));
  names.sort();
  return names.map((name) => join(assets, name));
}

function refusalOf(error: unknown): string {
  const reported = typeof error === 'string' ? sentencesIn(error) : [];
  return reported.length === 0 ? reasonOf(error) : reported.join('; ');
}

function sentencesIn(reported: string): readonly string[] {
  return [
    ...[...reported.matchAll(diagnosticMessages)].map((found) =>
      readable(found[1]),
    ),
    ...[...reported.matchAll(diagnosticHints)].flatMap((found) =>
      [...found[1].matchAll(quotedHint)].map((hint) => readable(hint[1])),
    ),
  ];
}

function readable(debugged: string): string {
  return debugged
    .replace(debugEscape, (_whole, character: string) =>
      character === '\\' || character === '"' ? character : ' ',
    )
    .replace(runsOfSpace, ' ')
    .trim();
}
