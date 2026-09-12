import type { Diagram, Model } from '@saerskriven/model';
import {
  drawingFace,
  renderPng,
  ResvgFailure,
  type PngImage,
} from '@saerskriven/render/png';
import { Either } from 'effect';
import { wasmAssets, type WasmAssets } from './assets.js';

/**
 * The name the rasterizer module is read back under, which the build writes
 * it as through `resvgWasmFile` on the `build-assets` subpath. The two cannot
 * share a definition: that subpath resolves paths at module load, so it never
 * rides into this bundle, and it is loaded as source by the build config,
 * which resolves no relative import of its own. The spec holds them equal.
 */
export const resvgWasmFile = 'saerskriven_resvg.wasm';

/**
 * One diagram rasterized to PNG bytes, or a sentence saying why it was not.
 *
 * Finding the bytes is this side's work, in `assets.ts`, and drawing them is
 * `@saerskriven/render/png`'s. The module's name and the face to lead with
 * are that subpath's too, since the build writes the one and the drawings are
 * lettered in the other. Handed the Typst compiler's order instead, which
 * leads with the Mono face, the whole diagram comes out in Liberation Mono
 * with every label overflowing the box the layout measured.
 *
 * The subpath answers with a tagged failure, which this side words into the
 * one line a command prints.
 */
export function drawPng(
  diagram: Diagram,
  model: Model,
  assets: string,
): Promise<Either.Either<PngImage, string>> {
  return Either.match(wasmAssets(assets, resvgWasmFile, drawingFace), {
    onLeft: (reason) =>
      Promise.resolve(Either.left(`cannot draw the PNG: ${reason}`)),
    onRight: (found) => rasterized(diagram, model, found),
  });
}

async function rasterized(
  diagram: Diagram,
  model: Model,
  assets: WasmAssets,
): Promise<Either.Either<PngImage, string>> {
  return Either.mapLeft(await renderPng(diagram, model, { assets }), reported);
}

function reported(failure: ResvgFailure): string {
  return ResvgFailure.$match(failure, {
    Refused: ({ sentence }) => `cannot draw the PNG: ${sentence}`,
    Unusable: ({ sentence }) => `cannot draw the PNG: ${sentence}`,
  });
}
