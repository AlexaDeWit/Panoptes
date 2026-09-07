/// <reference types="vitest" />
// Leaf configs pass options here so the shared build owns deviations.
import { defineConfig, type Plugin, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { cacheDir, sharedTest } from './vitest.shared.mts';

const searchIndexFiles = (siteUrl: string): Plugin => {
  const canonicalUrl = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;

  return {
    name: 'search-index-files',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'link',
        attrs: { href: canonicalUrl, rel: 'canonical' },
        injectTo: 'head',
      },
    ],
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${canonicalUrl}sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${canonicalUrl}</loc>
  </url>
</urlset>
`,
      });
    },
  };
};

export const reactLib = (projectRoot: string) =>
  defineConfig({
    root: projectRoot,
    cacheDir: cacheDir(projectRoot),
    plugins: [react()],
    test: sharedTest(projectRoot, 'jsdom'),
  });

type ReactAppOptions = {
  readonly base?: string;
  readonly cacheDirectory?: string;
  readonly outDirectory?: string;
  readonly port?: number;
  readonly plugins?: PluginOption[];
  readonly setupFiles?: string[];
  readonly siteUrl?: string;
};

export const reactApp = (
  projectRoot: string,
  {
    base,
    cacheDirectory,
    outDirectory = './dist',
    port = 4200,
    plugins = [],
    setupFiles = [],
    siteUrl,
  }: ReactAppOptions = {},
) =>
  defineConfig({
    base,
    root: projectRoot,
    cacheDir: cacheDirectory ?? cacheDir(projectRoot),
    plugins: [
      react(),
      ...plugins,
      ...(siteUrl === undefined ? [] : [searchIndexFiles(siteUrl)]),
    ],
    server: { port, host: 'localhost' },
    preview: { port, host: 'localhost' },
    build: {
      outDir: outDirectory,
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: { transformMixedEsModules: true },
    },
    test: sharedTest(projectRoot, 'jsdom', setupFiles),
  });
