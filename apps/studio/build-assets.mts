import { dirname, resolve } from 'node:path';
import {
  resvgWasmAsset,
  typstFontAssets,
  typstWasmModule,
  type TypstFontAsset,
} from '@saerskriven/render/build-assets';

const publicId = 'virtual:saerskriven-render-faces';
const resolvedId = `\0${publicId}`;
const typstId = 'virtual:saerskriven-typst-wasm?url';
const resvgId = 'virtual:saerskriven-resvg-wasm?url';

export const refuseStudioBuild = (sentence: string): never => {
  throw new Error(
    `${sentence} Run the studio inside the flake shell: nix develop --command pnpm nx build @saerskriven/studio`,
  );
};

// The flake shell exports the fonts and not the rasterizer module, so this
// build's recovery is to build the module and name it, which README.md's
// SVG rasterizer section shows. Pointing at the shell alone would not fix it.
const refuseRasterizer = (sentence: string): never => {
  throw new Error(
    `${sentence} No dev shell exports it: build it and name it as README.md's SVG rasterizer section shows.`,
  );
};

const faceId = (index: number): string =>
  `virtual:saerskriven-render-face-${String(index)}?url`;

const moduleFor = (assets: readonly TypstFontAsset[]): string => {
  const imports = assets.map(
    (_asset, index) =>
      `import face${String(index)} from ${JSON.stringify(faceId(index))};`,
  );
  const faces = assets.map(
    (asset, index) =>
      `{ name: ${JSON.stringify(asset.name)}, url: face${String(index)} }`,
  );
  return `${imports.join('\n')}
export const renderFaces = [${faces.join(', ')}];\n`;
};

/**
 * The Nix-provided Liberation faces and the two render-owned WebAssembly
 * modules as Vite assets: the compiler a PDF is typeset by, and the
 * rasterizer a PNG is drawn by. `@saerskriven/render/build-assets` names all
 * three, so the CLI and the studio cannot carry different ones.
 *
 * The faces arrive in the Typst compiler's order, which the PNG loader leads
 * with the face drawings are set in instead.
 */
export function buildAssets() {
  const assets = typstFontAssets(refuseStudioBuild);
  const resvgWasm = resvgWasmAsset(refuseRasterizer);
  const faces = new Map(
    assets.map((asset, index) => [faceId(index), `${asset.from}?url`]),
  );

  return {
    name: 'saerskriven-build-assets',
    resolveId(id: string): string | undefined {
      return id === publicId
        ? resolvedId
        : id === typstId
          ? `${typstWasmModule}?url`
          : id === resvgId
            ? `${resvgWasm}?url`
            : faces.get(id);
    },
    load(id: string): string | undefined {
      return id === resolvedId ? moduleFor(assets) : undefined;
    },
    config(): {
      readonly server: { readonly fs: { readonly allow: string[] } };
    } {
      return {
        server: {
          fs: {
            allow: [
              resolve(import.meta.dirname, '../..'),
              dirname(resvgWasm),
              ...new Set(assets.map((asset) => dirname(asset.from))),
            ],
          },
        },
      };
    },
  };
}
