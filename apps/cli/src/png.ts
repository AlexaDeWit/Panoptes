import type { RenderTheme } from '@saerskriven/render';
import type { Diagram, Model } from '@saerskriven/model';
import {
  drawingFace,
  renderPng,
  ResvgFailure,
  type PngImage,
} from '@saerskriven/render/png';
import { Either } from 'effect';
import { runtimeAssets, wasmAssets, type WasmAssets } from './assets.js';

/** Runtime filename shared with the build asset contract. */
export const resvgWasmFile = 'saerskriven_resvg.wasm';

/** Loads the rasterizer and faces with the drawing fallback first. */
export function pngAssets(
  assets: string = runtimeAssets,
): Either.Either<WasmAssets, string> {
  return wasmAssets(assets, resvgWasmFile, drawingFace);
}

/** One diagram rasterized to PNG bytes, or a sentence saying why it was not. */
export function drawPng(
  diagram: Diagram,
  model: Model,
  assets: string,
  theme?: RenderTheme,
): Promise<Either.Either<PngImage, string>> {
  return Either.match(pngAssets(assets), {
    onLeft: (reason) =>
      Promise.resolve(Either.left(`cannot draw the PNG: ${reason}`)),
    onRight: (found) => rasterized(diagram, model, found, theme),
  });
}

async function rasterized(
  diagram: Diagram,
  model: Model,
  assets: WasmAssets,
  theme?: RenderTheme,
): Promise<Either.Either<PngImage, string>> {
  return Either.mapLeft(
    await renderPng(diagram, model, { assets, theme }),
    reported,
  );
}

function reported(failure: ResvgFailure): string {
  return ResvgFailure.$match(failure, {
    Refused: ({ sentence }) => `cannot draw the PNG: ${sentence}`,
    Unusable: ({ sentence }) => `cannot draw the PNG: ${sentence}`,
  });
}
