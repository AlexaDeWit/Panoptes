import { dirname, resolve } from 'node:path';
import {
  typstFontAssets,
  typstWasmModule,
  type TypstFontAsset,
} from '@saerskriven/render/build-assets';

const publicId = 'virtual:saerskriven-typst-assets';
const resolvedId = `\0${publicId}`;
const wasmId = 'virtual:saerskriven-typst-wasm?url';

export const refuseStudioBuild = (sentence: string): never => {
  throw new Error(
    `${sentence} Run the studio inside the flake shell: nix develop --command pnpm nx build @saerskriven/studio`,
  );
};

const fontId = (index: number): string =>
  `virtual:saerskriven-typst-font-${String(index)}?url`;

const moduleFor = (assets: readonly TypstFontAsset[]): string => {
  const imports = assets.map(
    (_asset, index) =>
      `import font${String(index)} from ${JSON.stringify(fontId(index))};`,
  );
  const names = assets.map((_asset, index) => `font${String(index)}`);
  return `${imports.join('\n')}
export const typstFontUrls = [${names.join(', ')}];\n`;
};

/**
 * The Nix-provided PDF fonts and render-owned compiler module as Vite assets.
 */
export function typstAssets() {
  const assets = typstFontAssets(refuseStudioBuild);
  const fonts = new Map(
    assets.map((asset, index) => [fontId(index), `${asset.from}?url`]),
  );

  return {
    name: 'saerskriven-typst-assets',
    resolveId(id: string): string | undefined {
      return id === publicId
        ? resolvedId
        : id === wasmId
          ? `${typstWasmModule}?url`
          : fonts.get(id);
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
