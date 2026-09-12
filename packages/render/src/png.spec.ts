import type { Model } from '@saerskriven/model';
import { Either } from 'effect';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  resvgVariable,
  resvgWasmAsset,
  typstFontAssets,
} from './build-assets.js';
import {
  diagramOf,
  drawingFace,
  ecluseModel,
  everyGlyphModel,
  goldenDocuments,
  ledBy,
  repositoryRoot,
  type GoldenDocument,
} from './goldens.fixtures.js';
import { defaultLongEdge, renderPng, type PngImage } from './png.js';
import type { ResvgAssets } from './resvg.js';

const stop = (sentence: string): never => {
  throw new Error(sentence);
};

const unbuilt =
  process.env[resvgVariable] === undefined || process.env[resvgVariable] === '';

const monoFace = 'LiberationMono-Regular.ttf';

let loaded: ResvgAssets | undefined;

const assetsLedBy = (leading: string): ResvgAssets => {
  loaded ??= {
    wasm: new Uint8Array(readFileSync(resvgWasmAsset(stop))),
    fonts: [],
  };
  return {
    wasm: loaded.wasm,
    fonts: ledBy(typstFontAssets(stop), (face) => face.name, leading).map(
      (face) => new Uint8Array(readFileSync(face.from)),
    ),
  };
};

const rasterized = async (
  model: Model,
  longEdge?: number,
  leading = drawingFace,
): Promise<PngImage> =>
  Either.getOrThrow(
    await renderPng(model.diagrams[0], model, {
      assets: assetsLedBy(leading),
      longEdge,
    }),
  );

const goldenOf = async (entry: GoldenDocument): Promise<PngImage> =>
  Either.getOrThrow(
    await renderPng(diagramOf(entry), entry.model, {
      assets: assetsLedBy(drawingFace),
    }),
  );

const committed = (entry: GoldenDocument, drawn: Uint8Array): Buffer => {
  const path = join(repositoryRoot, entry.png);
  if (expect.getState().snapshotState.snapshotUpdateState === 'all') {
    writeFileSync(path, drawn);
  }
  return readFileSync(path);
};

describe.skipIf(unbuilt)('a diagram rasterized as a PNG', () => {
  it.each(goldenDocuments)(
    'draws $name as the committed picture',
    async (entry) => {
      const image = await goldenOf(entry);
      expect(Buffer.from(image.png)).toEqual(committed(entry, image.png));
    },
  );

  it.each(goldenDocuments)(
    'draws $name the same bytes on a second run',
    async (entry) => {
      const [first, second] = [await goldenOf(entry), await goldenOf(entry)];
      expect(Buffer.from(second.png)).toEqual(Buffer.from(first.png));
    },
  );

  it('letters a drawing in the face it is offered first', async () => {
    const [sansFirst, monoFirst] = [
      await rasterized(ecluseModel),
      await rasterized(ecluseModel, undefined, monoFace),
    ];
    expect([sansFirst.width, sansFirst.height]).toEqual([
      monoFirst.width,
      monoFirst.height,
    ]);
    expect(Buffer.from(monoFirst.png)).not.toEqual(Buffer.from(sansFirst.png));
  });

  it('puts the default long edge on the longer of the two edges', async () => {
    const image = await rasterized(ecluseModel);
    expect(image.width).toBe(defaultLongEdge);
    expect(image.height).toBeLessThan(defaultLongEdge);
  });

  it('takes the long edge a caller names, keeping the aspect ratio', async () => {
    const wide = await rasterized(ecluseModel, defaultLongEdge);
    const narrow = await rasterized(ecluseModel, defaultLongEdge / 2);
    expect(narrow.width).toBe(wide.width / 2);
    expect(narrow.height / narrow.width).toBeCloseTo(
      wide.height / wide.width,
      2,
    );
  });

  it('draws a diagram smaller than the long edge larger, not smaller', async () => {
    const image = await rasterized(ecluseModel, defaultLongEdge * 2);
    expect(image.width).toBe(defaultLongEdge * 2);
  });

  it('carries the endpoints the drawing left out', async () => {
    const image = await rasterized(everyGlyphModel);
    expect(image.unplaced).toEqual([
      { flow: 'el-replay', side: 'source', element: 'el-request' },
    ]);
  });

  it('reports a long edge it will not draw, rather than throwing it', async () => {
    const outcome = await renderPng(ecluseModel.diagrams[0], ecluseModel, {
      assets: assetsLedBy(drawingFace),
      longEdge: 0.5,
    });
    expect(Either.isLeft(outcome)).toBe(true);
  });
});
