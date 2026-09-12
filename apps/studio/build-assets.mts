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

// The flake names the module's path and the `resvg-wasm` project builds it
// there, so this build's recovery is that one task rather than a shell.
const refuseRasterizer = (sentence: string): never => {
  throw new Error(
    `${sentence} Run pnpm nx build resvg-wasm, which every target carrying the module depends on.`,
  );
};

// Read when the build asks for the module, not when this configuration is
// loaded. Nx loads it to build its project graph, before any task has run, so
// on a cold checkout the module is not there yet and an eager read would
// refuse every nx command in the workspace, the `resvg-wasm` build included.
let located: string | undefined;
const rasterizerModule = (): string =>
  (located ??= resvgWasmAsset(refuseRasterizer));

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
            ? `${rasterizerModule()}?url`
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
              ...new Set(assets.map((asset) => dirname(asset.from))),
            ],
          },
        },
      };
    },
  };
}
