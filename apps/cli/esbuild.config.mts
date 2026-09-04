import { versionDefine } from '../../workspace-version.mts';

// yaml's CommonJS dist calls require() at run time, which in an ESM bundle
// reaches esbuild's __require shim and throws unless a real require is in
// scope. Nothing but a banner can put one there.
const nodeRequireBanner = [
  "import { createRequire as createNodeRequire } from 'node:module';",
  'const require = createNodeRequire(import.meta.url);',
].join('\n');

export default {
  define: versionDefine(),
  banner: { js: nodeRequireBanner },
};
