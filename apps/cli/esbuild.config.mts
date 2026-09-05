import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
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

const projectAssets = join(import.meta.dirname, 'src/assets');

// Everything the executable carries beside its bundle, gathered in
// dist/assets: the fonts, which the PDF path reads, and the licence and
// provenance record that travel with them. The Typst WebAssembly module joins
// them from node_modules rather than from the tree. esbuild inlines
// JavaScript and nothing else, so all of it arrives as files. src/pdf.ts
// reaches the fonts and the module through import.meta.dirname, and
// `deno compile --include` puts the same directory inside an executable
// (scripts/package-cli.sh). A file that is neither inlined nor included does
// not exist for a user who has only the executable.
const runtimeAssets = (): readonly string[] => [
  ...readdirSync(projectAssets, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(projectAssets, entry.name)),
  resolve.resolve('@myriaddreamin/typst-ts-web-compiler/wasm'),
];

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
        copyFileSync(asset, join(target, basename(asset)));
      }
    });
  },
};

export default {
  define: versionDefine(),
  banner: { js: nodeRequireBanner },
  plugins: [copyRuntimeAssets],
};
