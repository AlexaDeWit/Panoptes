import {
  defaultRenderTheme,
  type RenderTheme,
  type UnplacedEndpoint,
} from '@saerskriven/canvas';
import type { Diagram, Model } from '@saerskriven/model';
import { Either } from 'effect';
import { renderSvg } from './lib/svg-document.js';
import { rasterizeSvg, type ResvgAssets, type ResvgFailure } from './resvg.js';

export { ResvgFailure } from './resvg-failures.js';

/** Default raster size on the longer edge, in pixels. */
export const defaultLongEdge = 1568;

/** Leading face for the rasterizer fallback family. */
export const drawingFace = 'LiberationSans-Regular.ttf';

/** Orders faces with the requested fallback first, or reports its absence. */
export function ledBy<T>(
  faces: readonly T[],
  named: (face: T) => string,
  leading: string,
  subject: string,
): Either.Either<readonly T[], string> {
  const leads = (face: T): boolean => named(face) === leading;
  return faces.some(leads)
    ? Either.right([
        ...faces.filter(leads),
        ...faces.filter((face) => !leads(face)),
      ])
    : Either.left(`${subject} holds no ${leading}, which text is set in`);
}

/** Rasterizer assets, output size, and resolved appearance. */
export type PngOptions = {
  readonly assets: ResvgAssets;
  readonly longEdge?: number;
  readonly theme?: RenderTheme;
};

/** PNG bytes, pixel dimensions, and undrawn flow endpoints. */
export type PngImage = {
  readonly png: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly unplaced: readonly UnplacedEndpoint[];
};

/** Rasterizes the themed SVG with its selected background. */
export async function renderPng(
  diagram: Diagram,
  model: Model,
  options: PngOptions,
): Promise<Either.Either<PngImage, ResvgFailure>> {
  const theme = options.theme ?? defaultRenderTheme;
  const drawn = renderSvg(diagram, model, theme);
  const raster = await rasterizeSvg(
    drawn.svg,
    options.assets,
    options.longEdge ?? defaultLongEdge,
  );
  return Either.map(raster, (image) => ({
    png: image.png,
    width: image.width,
    height: image.height,
    unplaced: drawn.unplaced,
  }));
}
