import { join } from 'node:path';
import { reactApp } from '../../vite.shared.mts';
import { typstAssets } from './typst-assets.mjs';

const siteUrl =
  process.env['PAGES_SITE_URL'] ?? 'https://alexadewit.github.io/Saerskriven';
const pagesBasePath = process.env['PAGES_BASE_PATH'];
const pagesPreview = process.env['PAGES_PREVIEW_PORT'] !== undefined;
const base =
  pagesBasePath === undefined
    ? undefined
    : `${pagesBasePath.replace(/\/+$/u, '')}/`;

export default reactApp(import.meta.dirname, {
  base,
  cacheDirectory: pagesPreview
    ? join(import.meta.dirname, '../../node_modules/.vite/studio-pages')
    : undefined,
  outDirectory: pagesPreview
    ? '../studio-e2e/test-output/pages-site'
    : undefined,
  plugins: [typstAssets()],
  setupFiles: ['./src/test-setup.ts'],
  siteUrl,
});
