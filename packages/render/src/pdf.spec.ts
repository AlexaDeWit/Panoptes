import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { compilePdf, PdfFailure, type PdfAssets } from './pdf.js';

const wasmModule = createRequire(import.meta.url).resolve(
  '@myriaddreamin/typst-ts-web-compiler/wasm',
);

const assets: PdfAssets = { wasm: readFileSync(wasmModule), fonts: [] };

const refusalOf = (
  outcome: Either.Either<Uint8Array, PdfFailure>,
): PdfFailure | undefined =>
  Either.isLeft(outcome) ? outcome.left : undefined;

describe('Typst source compiled to a PDF', () => {
  it('compiles the bytes it is handed and reads no file', async () => {
    const drawing = '#set page(paper: "a4")\n#rect(width: 10pt, height: 10pt)';
    const pdf = Either.getOrThrow(await compilePdf(drawing, assets));
    expect(Buffer.from(pdf.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
  });

  it('reports what the compiler refused, rather than throwing it', async () => {
    expect(refusalOf(await compilePdf('#no-such-function()', assets))).toEqual(
      PdfFailure.Refused({
        sentences: [
          'unknown variable: no-such-function',
          'if you meant to use subtraction, try adding spaces around the minus signs: `no - such - function`',
        ],
      }),
    );
  });

  it("carries the compiler's hints beside its message, in order", async () => {
    const deep = `${'#quote(block: true)['.repeat(20)}x${']'.repeat(20)}`;
    expect(refusalOf(await compilePdf(deep, assets))).toEqual(
      PdfFailure.Refused({
        sentences: [
          'maximum show rule depth exceeded',
          'maybe a show rule matches its own output',
          'maybe there are too deeply nested elements',
        ],
      }),
    );
  });

  it('gives back a quote the compiler escaped, as the quote it stands for', async () => {
    expect(
      refusalOf(await compilePdf('#panic("a quoted word")', assets)),
    ).toEqual(
      PdfFailure.Refused({ sentences: ['panicked with: "a quoted word"'] }),
    );
  });
});
