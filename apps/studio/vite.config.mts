import { reactApp } from '../../vite.shared.mts';
import { typstAssets } from './typst-assets.mjs';

const siteUrl =
  process.env['PAGES_SITE_URL'] ?? 'https://alexadewit.github.io/Saerskriven';

export default reactApp(import.meta.dirname, {
  plugins: [typstAssets()],
  setupFiles: ['./src/test-setup.ts'],
  siteUrl,
});
