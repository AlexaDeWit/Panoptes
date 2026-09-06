import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { compilePdf, type PdfAssets } from './pdf.js';

const wasmModule = createRequire(import.meta.url).resolve(
  '@myriaddreamin/typst-ts-web-compiler/wasm',
);

const assets: PdfAssets = { wasm: readFileSync(wasmModule), fonts: [] };

const refusal = (outcome: Either.Either<Uint8Array, string>): string =>
  Either.match(outcome, {
    onLeft: (reason) => reason,
    onRight: () => 'the compile succeeded',
  });

describe('Typst source compiled to a PDF', () => {
  it('compiles the bytes it is handed and reads no file', async () => {
    const drawing = '#set page(paper: "a4")\n#rect(width: 10pt, height: 10pt)';
    const pdf = Either.getOrThrow(await compilePdf(drawing, assets));
    expect(Buffer.from(pdf.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
  });

  it('reports what the compiler refused, rather than throwing it', async () => {
    expect(refusal(await compilePdf('#no-such-function()', assets))).toBe(
      'cannot compile the PDF: unknown variable: no-such-function; if you meant to use subtraction, try adding spaces around the minus signs: `no - such - function`',
    );
  });

  it("joins the compiler's hints into the sentence it reports", async () => {
    const deep = `${'#quote(block: true)['.repeat(20)}x${']'.repeat(20)}`;
    expect(refusal(await compilePdf(deep, assets))).toBe(
      'cannot compile the PDF: maximum show rule depth exceeded; maybe a show rule matches its own output; maybe there are too deeply nested elements',
    );
  });

  it('gives back a quote the compiler escaped, as the quote it stands for', async () => {
    expect(refusal(await compilePdf('#panic("a quoted word")', assets))).toBe(
      'cannot compile the PDF: panicked with: "a quoted word"',
    );
  });
});
