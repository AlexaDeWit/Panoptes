import {
  resvgVariable,
  resvgWasmAsset,
  typstFontAssets,
} from '@saerskriven/render/build-assets';
import { drawingFace } from '@saerskriven/render/png';
import type { ResvgAssets } from '@saerskriven/render/resvg';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import type { RasterizerAssets } from './render-diagram.js';

/**
 * Whether the rasterizer module has been built. No dev shell exports the
 * variable naming it, since the module is built from Rust and entering a
 * shell to work on the TypeScript should pay for neither, so a suite that
 * draws skips rather than fails where it is unset.
 */
export const rasterizerUnbuilt =
  process.env[resvgVariable] === undefined || process.env[resvgVariable] === '';

/**
 * The flake-built module with the faces led by the one the drawings are
 * lettered in. The Typst compiler's own order leads with the Mono face, and a
 * rasterization offered that order letters the whole diagram in Liberation
 * Mono, so the reordering here is the decision `apps/cli` makes for the CLI.
 */
export const builtRasterizer: RasterizerAssets = () => {
  const faces = typstFontAssets(refuse);
  const assets: ResvgAssets = {
    wasm: new Uint8Array(readFileSync(resvgWasmAsset(refuse))),
    fonts: [
      ...faces.filter((font) => font.name === drawingFace),
      ...faces.filter((font) => font.name !== drawingFace),
    ].map((font) => new Uint8Array(readFileSync(font.from))),
  };
  return Either.right(assets);
};

function refuse(sentence: string): never {
  throw new Error(sentence);
}
