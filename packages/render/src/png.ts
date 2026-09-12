import { lightPalette, type UnplacedEndpoint } from '@saerskriven/canvas';
import type { Diagram, Model } from '@saerskriven/model';
import { Either } from 'effect';
import { renderSvg, type SvgDocument } from './lib/svg-document.js';
import { rasterizeSvg, type ResvgAssets, type ResvgFailure } from './resvg.js';

export { ResvgFailure } from './resvg-failures.js';

/**
 * The long edge a render takes when its caller names none, in pixels. It is
 * the size an MCP host downscales an image block to, so a diagram rendered at
 * it reaches an agent without being resampled on the way.
 */
export const defaultLongEdge = 1568;

/**
 * The face a rasterization is offered first, which decides the family every
 * drawing is lettered in: a family no loaded face carries falls back to the
 * family of the first face offered, and the drawings name Helvetica and
 * Arial, which no Liberation face carries.
 *
 * The fallback resolves per family rather than per face, so leading with any
 * Liberation Sans face makes the fallback family Liberation Sans and weight
 * and style then resolve within it as usual. The regular face is named
 * because it is the one an install must not be missing: without it the
 * remaining Sans faces are bold and italic, and body text would be lettered
 * in one of them.
 *
 * It lives on this subpath rather than beside the module's own name in
 * `build-assets`, which is loaded as source by a build config and so cannot
 * reach a relative import, where a caller running inside a bundle can.
 */
export const drawingFace = 'LiberationSans-Regular.ttf';

/**
 * The faces a rasterization is offered, the one `leading` names first, which
 * is the order {@link drawingFace} explains. `named` reads the name off
 * whatever a caller carries a face as, a path or a URL, and `subject` is what
 * holds the faces, a directory or a build, which opens the refusal.
 *
 * A caller holding no face by that name is refused rather than served the
 * order it had: the drawing would come out in whichever family happened to be
 * first, which a reader cannot tell from the one that was asked for.
 */
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

/**
 * What a render was asked for. `assets` is what `rasterizeSvg` reads, module
 * and faces, and a family no face carries falls back to the family of the
 * first face offered, which for these drawings is every family they name.
 * `longEdge` is the pixel
 * length the longer of the image's two edges takes, whichever that is, and it
 * defaults to {@link defaultLongEdge}: a caller wanting a larger image than
 * an MCP host accepts states the number.
 */
export type PngOptions = {
  readonly assets: ResvgAssets;
  readonly longEdge?: number;
};

/**
 * One diagram rasterized: `png` is the bytes of a PNG file, `width` and
 * `height` are its pixels, and `unplaced` is what the drawing left out, which
 * is the same list {@link renderSvg} reports and is lost by a caller that
 * drops it.
 */
export type PngImage = {
  readonly png: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly unplaced: readonly UnplacedEndpoint[];
};

/**
 * One diagram of a model as the bytes of a PNG file, rasterized from the
 * document {@link renderSvg} writes, so the picture and a standalone `.svg`
 * file are the one drawing. It is here because MCP hosts take an image block
 * as PNG, JPEG, GIF or WebP and never as SVG.
 *
 * The aspect ratio is the drawing's own and the longer edge is
 * `options.longEdge`, so a diagram smaller than that is drawn larger rather
 * than placed in a field of background.
 *
 * The drawing is rasterized on the canvas ground rather than on
 * transparency. Its colours are the light table, measured for contrast
 * against that ground, and a viewer that fills transparency with its own dark
 * theme would put them on something else. The renderer paints no background
 * of its own, so the document is nested inside one that carries it.
 *
 * Nothing throws: what the rasterizer refuses comes back as
 * {@link ResvgFailure} on the left, unworded, since a command prints it and a
 * tool result carries it and neither reads a message written for the other.
 */
export async function renderPng(
  diagram: Diagram,
  model: Model,
  options: PngOptions,
): Promise<Either.Either<PngImage, ResvgFailure>> {
  const drawn = renderSvg(diagram, model);
  const raster = await rasterizeSvg(
    grounded(drawn),
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

function grounded(drawn: SvgDocument): string {
  const size = `width="${String(drawn.width)}" height="${String(drawn.height)}"`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" ${size}>`,
    `<rect ${size} fill="${lightPalette.surfaceCanvas}"/>`,
    drawn.svg,
    '</svg>',
  ].join('');
}
