import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/** The environment variable naming the pinned Liberation font directory. */
export const fontsVariable = 'SAERSKRIVEN_FONTS_DIR';

/** The environment variable naming the flake-built rasterizer module. */
export const resvgVariable = 'SAERSKRIVEN_RESVG_WASM';

/** The name the rasterizer module is carried under beside a bundle. */
export const resvgWasmFile = 'saerskriven_resvg.wasm';

/**
 * The faces every Saerskriven PDF uses, in compiler order. That order is the
 * Typst compiler's and not the rasterizer's: `@saerskriven/render/resvg` falls
 * an unmatched family back to the first face it is offered, so a caller of
 * that subpath leads with the face it wants text drawn in.
 */
export const typstFontFiles: readonly string[] = [
  'LiberationMono-Regular.ttf',
  'LiberationSans-Bold.ttf',
  'LiberationSans-BoldItalic.ttf',
  'LiberationSans-Italic.ttf',
  'LiberationSans-Regular.ttf',
];

const resolve = createRequire(import.meta.url);

/** The WebAssembly module paired with render's compiler dependency. */
export const typstWasmModule = resolve.resolve(
  '@myriaddreamin/typst-ts-web-compiler/wasm',
);

/** One font a host build must carry for the PDF compiler. */
export type TypstFontAsset = {
  readonly from: string;
  readonly name: string;
};

/**
 * The fonts a host build must carry.
 *
 * The caller supplies its own refusal because the recovery command names the
 * host being built. The font list lives here so the CLI and studio cannot
 * choose different faces or a different compiler order.
 */
export function typstFontAssets(
  refuse: (sentence: string) => never,
): readonly TypstFontAsset[] {
  const fonts = process.env[fontsVariable];
  if (fonts === undefined || fonts === '') {
    refuse(`${fontsVariable} is unset, so this build has no PDF fonts.`);
  }
  return typstFontFiles.map((name) => ({
    from: requiredFont(fonts, name, refuse),
    name,
  }));
}

/**
 * The rasterizer module a host build must carry.
 *
 * Both dev shells export the variable, and what it names is the path the
 * `resvg-wasm` project's build writes the module to rather than a store path,
 * so a target that carries the module declares a dependency on that build
 * instead of a caller pointing the variable somewhere. No shell carries the
 * module or the Rust toolchain that builds it. The caller supplies its own
 * refusal, as it does for the fonts, and names the recovery in it.
 */
export function resvgWasmAsset(refuse: (sentence: string) => never): string {
  const module = process.env[resvgVariable];
  if (module === undefined || module === '') {
    refuse(
      `${resvgVariable} is unset, so this build has no SVG rasterizer. nix build .#resvg-wasm writes one under lib/${resvgWasmFile}.`,
    );
  }
  return existsSync(module)
    ? module
    : refuse(`${resvgVariable} names ${module}, which is not there.`);
}

function requiredFont(
  directory: string,
  name: string,
  refuse: (sentence: string) => never,
): string {
  const found = join(directory, name);
  return existsSync(found)
    ? found
    : refuse(`${fontsVariable} names ${directory}, which holds no ${name}.`);
}
