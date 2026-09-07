import { Either } from 'effect';
import { PdfFailure } from './pdf-failures.js';

export { PdfFailure } from './pdf-failures.js';

const mainFile = '/main.typ';

const noDiagnostics = 0;

const diagnosticMessages = /\bmessage:\s*"((?:[^"\\]|\\.)*)"/gu;

const diagnosticHints = /\bhints:\s*\[([^\]]*)\]/gu;

const quotedHint = /"((?:[^"\\]|\\.)*)"/gu;

const debugEscape = /\\(.)/gu;

const runsOfSpace = /\s+/gu;

const starts = new WeakMap<Uint8Array, Promise<void>>();
let firstStart: Promise<void> | undefined;

type CompilerModule = typeof import('@myriaddreamin/typst-ts-web-compiler');

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
 * Compiles Typst source with caller-owned assets. The asynchronous module
 * start supports browsers, and a refusal returns as {@link PdfFailure}.
 */
export async function compilePdf(
  source: string,
  assets: PdfAssets,
): Promise<Either.Either<Uint8Array, PdfFailure>> {
  try {
    const compiler = await compilerWith(assets);
    try {
      compiler.add_source(mainFile, source);
      const artifact: unknown = compiler.compile(
        mainFile,
        null,
        'pdf',
        noDiagnostics,
      );
      return artifact instanceof Uint8Array
        ? Either.right(artifact)
        : Either.left(PdfFailure.NoDocument());
    } finally {
      compiler.free();
    }
  } catch (error) {
    return Either.left(PdfFailure.Refused({ sentences: refusalOf(error) }));
  }
}

async function compilerWith(assets: PdfAssets) {
  const compiler = await import('@myriaddreamin/typst-ts-web-compiler');
  await started(assets.wasm, compiler.default);
  const builder = new compiler.TypstCompilerBuilder();
  builder.set_dummy_access_model();
  for (const font of assets.fonts) {
    await builder.add_raw_font(font);
  }
  return builder.build();
}

function started(
  wasm: Uint8Array,
  initialise: CompilerModule['default'],
): Promise<void> {
  const known = starts.get(wasm);
  if (known !== undefined) {
    return known;
  }
  firstStart ??= initialise({ module_or_path: wasm }).then(
    () => undefined,
    (error: unknown) => {
      firstStart = undefined;
      throw error;
    },
  );
  const attempt = firstStart.catch((error: unknown) => {
    starts.delete(wasm);
    throw error;
  });
  starts.set(wasm, attempt);
  return attempt;
}

function refusalOf(error: unknown): readonly string[] {
  const reported = typeof error === 'string' ? sentencesIn(error) : [];
  return reported.length > 0
    ? reported
    : [error instanceof Error ? error.message : String(error)];
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
