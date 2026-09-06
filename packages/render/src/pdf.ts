import {
  initSync,
  TypstCompilerBuilder,
} from '@myriaddreamin/typst-ts-web-compiler';
import { Either } from 'effect';

const mainFile = '/main.typ';

const noDiagnostics = 0;

const diagnosticMessages = /\bmessage:\s*"((?:[^"\\]|\\.)*)"/gu;

const diagnosticHints = /\bhints:\s*\[([^\]]*)\]/gu;

const quotedHint = /"((?:[^"\\]|\\.)*)"/gu;

const debugEscape = /\\(.)/gu;

const runsOfSpace = /\s+/gu;

const initialised = new WeakSet<Uint8Array>();

/**
 * The bytes a compile runs on, because this package reads no file: `wasm` is
 * the Typst WebAssembly module, and `fonts` are the faces to typeset with,
 * added to the compiler in the order they are listed.
 */
export type PdfAssets = {
  readonly wasm: Uint8Array;
  readonly fonts: readonly Uint8Array[];
};

/**
 * Typst source compiled to a PDF, or a sentence saying why it was not.
 *
 * The compiler is the Typst WebAssembly build, given no access model, so it
 * has no filesystem and no package registry: the source has to carry
 * everything it draws, which is what `renderTypst` writes. The faces are the
 * caller's and are loaded in memory, so nothing is read from the host's font
 * directories and one source with one set of faces gives one PDF on every
 * machine.
 *
 * The WebAssembly module starts once per process. The guard is keyed on the
 * identity of the `wasm` array, so a caller handing back the array it handed
 * before starts nothing further, and one reading a fresh copy each time
 * misses the guard and reaches an initialisation that returns without
 * looking at the bytes. Either way the first module a process starts is the
 * one it keeps: a second cannot replace it.
 *
 * Nothing here throws. The WebAssembly module reports a compile failure by
 * throwing a string holding Rust's own debug rendering of its diagnostics,
 * which comes back on the left as a sentence for a user to read. What that
 * rendering carries and a user needs is the message and the hints; the byte
 * offsets and the empty traces beside them are not, and a rendering this
 * does not recognize is reported as it stands rather than swallowed.
 */
export async function compilePdf(
  source: string,
  assets: PdfAssets,
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

async function compilerWith(assets: PdfAssets) {
  started(assets.wasm);
  const builder = new TypstCompilerBuilder();
  builder.set_dummy_access_model();
  for (const font of assets.fonts) {
    await builder.add_raw_font(font);
  }
  return builder.build();
}

function started(wasm: Uint8Array): void {
  if (initialised.has(wasm)) {
    return;
  }
  initSync({ module: wasm });
  initialised.add(wasm);
}

function refusalOf(error: unknown): string {
  const reported = typeof error === 'string' ? sentencesIn(error) : [];
  if (reported.length > 0) {
    return reported.join('; ');
  }
  return error instanceof Error ? error.message : String(error);
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
