import {
  compilePdf as compileTypst,
  PdfFailure,
} from '@saerskriven/render/pdf';
import { Either } from 'effect';
import { wasmAssets, type WasmAssets } from './assets.js';

const wasmModule = 'typst_ts_web_compiler_bg.wasm';

/**
 * Typst source compiled to a PDF, or a sentence saying why it was not.
 *
 * Finding the bytes is this side's work, in `assets.ts`, and typesetting them
 * is `@saerskriven/render/pdf`'s. The faces arrive in name order, which is the
 * order the compiler is given them in.
 *
 * The subpath answers with a tagged failure, which this side words: a
 * command prints one line, so the compiler's sentences are joined with
 * semicolons behind the same opening the unreadable directory gets.
 */
export function compilePdf(
  source: string,
  assets: string,
): Promise<Either.Either<Uint8Array, string>> {
  return Either.match(wasmAssets(assets, wasmModule), {
    onLeft: (reason) =>
      Promise.resolve(Either.left(`cannot compile the PDF: ${reason}`)),
    onRight: (found) => typeset(source, found),
  });
}

async function typeset(
  source: string,
  assets: WasmAssets,
): Promise<Either.Either<Uint8Array, string>> {
  return Either.mapLeft(await compileTypst(source, assets), reported);
}

function reported(failure: PdfFailure): string {
  return PdfFailure.$match(failure, {
    Refused: ({ sentences }) =>
      `cannot compile the PDF: ${sentences.join('; ')}`,
    NoDocument: () => 'the Typst compiler produced no PDF',
  });
}
