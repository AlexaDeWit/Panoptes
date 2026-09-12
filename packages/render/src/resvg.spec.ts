import { Either } from 'effect';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  resvgVariable,
  resvgWasmAsset,
  typstFontAssets,
} from './build-assets.js';
import { rasterizeSvg, ResvgFailure, type ResvgAssets } from './resvg.js';

const stop = (sentence: string): never => {
  throw new Error(sentence);
};

const unbuilt =
  process.env[resvgVariable] === undefined || process.env[resvgVariable] === '';

let loaded: Uint8Array | undefined;

const wasm = (): Uint8Array =>
  (loaded ??= new Uint8Array(readFileSync(resvgWasmAsset(stop))));

const withFonts = (): ResvgAssets => ({
  wasm: wasm(),
  fonts: typstFontAssets(stop).map(
    (font) => new Uint8Array(readFileSync(font.from)),
  ),
});

const withoutFonts = (): ResvgAssets => ({ wasm: wasm(), fonts: [] });

const svg = (body: string, width: number, height: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`;

const rectangle = svg('<rect width="40" height="20" fill="#123456"/>', 40, 20);

const label =
  '<text x="4" y="30" font-size="20" fill="#000000">Saerskriven</text>';

const digestOf = (png: Uint8Array): string =>
  createHash('sha256').update(png).digest('hex');

const drawn = async (document: string, assets: ResvgAssets, longEdge: number) =>
  Either.getOrThrow(await rasterizeSvg(document, assets, longEdge));

const refusalOf = (
  outcome: Either.Either<unknown, ResvgFailure>,
): ResvgFailure | undefined =>
  Either.isLeft(outcome) ? outcome.left : undefined;

describe.skipIf(unbuilt)('an SVG document rasterized to a PNG', () => {
  it('draws the document at the long edge it is given', async () => {
    const raster = await drawn(rectangle, withoutFonts(), 200);
    expect([raster.width, raster.height]).toEqual([200, 100]);
    expect(Array.from(raster.png.subarray(0, 8))).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect(digestOf(raster.png)).toBe(
      '900aee59f6b2ec4c280c8826e5187bacd6f12a958edf52313f2cfb59ec9c1578',
    );
  });

  it('draws at the size the document names when the long edge is 0', async () => {
    const raster = await drawn(rectangle, withoutFonts(), 0);
    expect([raster.width, raster.height]).toEqual([40, 20]);
  });

  it('reports what the renderer refused, rather than throwing it', async () => {
    expect(
      refusalOf(await rasterizeSvg('not a document', withoutFonts(), 100)),
    ).toEqual(
      ResvgFailure.Refused({
        sentence: 'SVG data parsing failed cause unknown token at 1:1',
      }),
    );
  });

  it('sets text in the faces it is handed and in nothing else', async () => {
    const document = svg(label, 200, 40);
    const set = await drawn(document, withFonts(), 400);
    const unset = await drawn(document, withoutFonts(), 400);
    expect([set.width, set.height]).toEqual([400, 80]);
    expect(digestOf(set.png)).not.toBe(digestOf(unset.png));
  });

  it('reaches no file an image points it at', async () => {
    const pointed = svg(
      '<rect width="40" height="20" fill="#123456"/><image href="/etc/hostname" x="0" y="0" width="40" height="20"/>',
      40,
      20,
    );
    const raster = await drawn(pointed, withoutFonts(), 200);
    expect(digestOf(raster.png)).toBe(
      digestOf((await drawn(rectangle, withoutFonts(), 200)).png),
    );
  });
});
