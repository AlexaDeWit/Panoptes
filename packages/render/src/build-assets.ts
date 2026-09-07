import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/** The environment variable naming the pinned Liberation font directory. */
export const fontsVariable = 'SAERSKRIVEN_FONTS_DIR';

/** The faces every Saerskriven PDF uses, in compiler order. */
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
