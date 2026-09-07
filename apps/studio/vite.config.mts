import { reactApp } from '../../vite.shared.mts';
import { typstAssets } from './typst-assets.mjs';

const siteUrl =
  process.env['PAGES_SITE_URL'] ?? 'https://alexadewit.github.io/Saerskriven';
const pagesBasePath = process.env['PAGES_BASE_PATH'];
const base =
  pagesBasePath === undefined
    ? undefined
    : `${pagesBasePath.replace(/\/+$/u, '')}/`;

export default reactApp(import.meta.dirname, {
  base,
  plugins: [typstAssets()],
  setupFiles: ['./src/test-setup.ts'],
  siteUrl,
});
