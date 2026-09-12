import type { Diagram, Model } from '@saerskriven/model';
import {
  renderPng,
  ResvgFailure,
  type PngImage,
} from '@saerskriven/render/png';
import { Either } from 'effect';
import { wasmAssets, type WasmAssets } from './assets.js';

const wasmModule = 'saerskriven_resvg.wasm';

const fallbackFace = 'LiberationSans-Regular.ttf';

/**
 * One diagram rasterized to PNG bytes, or a sentence saying why it was not.
 *
 * Finding the bytes is this side's work, in `assets.ts`, and drawing them is
 * `@saerskriven/render/png`'s. The faces are handed over with Liberation Sans
 * first: the renderer falls a family no face carries back to the first it was
 * offered, and the drawings name Helvetica and Arial, which no Liberation
 * face carries, so every drawing takes that fallback. Handed the Typst
 * compiler's order instead, which leads with the Mono face, the whole diagram
 * comes out in Liberation Mono.
 *
 * The subpath answers with a tagged failure, which this side words into the
 * one line a command prints.
 */
export function drawPng(
  diagram: Diagram,
  model: Model,
  assets: string,
): Promise<Either.Either<PngImage, string>> {
  return Either.match(wasmAssets(assets, wasmModule, fallbackFace), {
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
