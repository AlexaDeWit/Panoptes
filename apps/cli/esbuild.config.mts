import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { versionDefine } from '../../workspace-version.mts';

// yaml's CommonJS dist calls require() at run time, which in an ESM bundle
// reaches esbuild's __require shim and throws unless a real require is in
// scope. Nothing but a banner can put one there.
const nodeRequireBanner = [
  "import { createRequire as createNodeRequire } from 'node:module';",
  'const require = createNodeRequire(import.meta.url);',
].join('\n');

const resolve = createRequire(import.meta.url);

// Both dev shells export this, pointing at the truetype directory of nixpkgs'
// liberation_ttf. The fonts are a toolchain input rather than something the
// tree carries, so their provenance is the nixpkgs revision flake.lock pins
// (CODING.md, Dependencies and versions).
const fontsVariable = 'PANOPTES_FONTS_DIR';

// Named one at a time rather than copied wholesale: liberation_ttf ships
// twelve faces, src/pdf.ts loads every .ttf it finds beside the bundle, and a
// face that arrives there moves the PDF the render golden fixes.
const fontFiles = [
  'LiberationMono-Regular.ttf',
  'LiberationSans-Bold.ttf',
  'LiberationSans-BoldItalic.ttf',
  'LiberationSans-Italic.ttf',
  'LiberationSans-Regular.ttf',
];

// The OFL asks that the licence travel with the fonts. liberation_ttf ships
// it as share/doc/liberation-fonts-<version>/LICENSE, which no fixed path can
// name, so it is looked up beside the fonts and copied under the name the
// executable already carried it by.
const licenceFile = 'LICENSE';

const licenceName = 'LICENSE.liberation-fonts.txt';

const wasmModule = resolve.resolve('@myriaddreamin/typst-ts-web-compiler/wasm');

type RuntimeAsset = { readonly from: string; readonly to: string };

// A missing input stops the build with one sentence naming it. The
// alternative is an executable that answers every command except the one that
// typesets, which only the packaging script's PDF check would catch.
const refuse = (sentence: string): never => {
  console.error(sentence);
  process.exit(1);
};

const fontsDirectory = (): string => {
  const configured = process.env[fontsVariable];
  return configured === undefined || configured === ''
    ? refuse(
        `${fontsVariable} is unset, so this build has no fonts for the CLI to typeset with. Run it inside the flake shell, which exports them: nix develop --command pnpm nx build @panoptes/cli`,
      )
    : configured;
};

const fontIn = (fonts: string, name: string): string => {
  const found = join(fonts, name);
  return existsSync(found)
    ? found
    : refuse(`${fontsVariable} names ${fonts}, which holds no ${name}.`);
};

const licenceIn = (fonts: string): string => {
  const documentation = join(fonts, '..', '..', 'doc');
  const shipped = existsSync(documentation)
    ? readdirSync(documentation).map((release) =>
        join(documentation, release, licenceFile),
      )
    : [];
  return (
    shipped.find((path) => existsSync(path)) ??
    refuse(
      `${fontsVariable} names ${fonts}, whose package ships no ${licenceFile} under ${documentation}. The fonts do not travel without it.`,
    )
  );
};

// Everything the executable carries beside its bundle, gathered in
// dist/assets: the fonts and their licence out of the flake, and the Typst
// WebAssembly module out of node_modules. esbuild inlines JavaScript and
// nothing else, so all of it arrives as files. src/pdf.ts reaches the fonts
// and the module through import.meta.dirname, and `deno compile --include`
// puts the same directory inside an executable (scripts/package-cli.sh). A
// file that is neither inlined nor included does not exist for a user who has
// only the executable.
const runtimeAssets = (): readonly RuntimeAsset[] => {
  const fonts = fontsDirectory();
  return [
    ...fontFiles.map((name) => ({ from: fontIn(fonts, name), to: name })),
    { from: licenceIn(fonts), to: licenceName },
    { from: wasmModule, to: basename(wasmModule) },
  ];
};

// Structural rather than esbuild's own PluginBuild: importing that type would
// mean declaring esbuild in this app's manifest under the explicit-dependency
// rule, for a build-time file that never reaches the bundle. What the plugin
// touches is two fields and one method.
type EsbuildPlugin = {
  initialOptions: { readonly outfile?: string; readonly outdir?: string };
  onEnd: (callback: () => void) => void;
};

const copyRuntimeAssets = {
  name: 'panoptes-runtime-assets',
  setup(build: EsbuildPlugin): void {
    build.onEnd(() => {
      const { outfile, outdir } = build.initialOptions;
      const target = join(outdir ?? dirname(outfile ?? '.'), 'assets');
      mkdirSync(target, { recursive: true });
      for (const asset of runtimeAssets()) {
        const copied = join(target, asset.to);
        copyFileSync(asset.from, copied);
        // The store is read only and copyFileSync carries the source's mode
        // over, so a second build into a directory it did not empty would
        // fail to overwrite what the first one wrote.
        chmodSync(copied, 0o644);
      }
    });
  },
};

export default {
  define: versionDefine(),
  banner: { js: nodeRequireBanner },
  plugins: [copyRuntimeAssets],
};
