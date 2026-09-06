import { reactApp } from '../../vite.shared.mts';

const siteUrl =
  process.env['PAGES_SITE_URL'] ?? 'https://alexadewit.github.io/Saerskriven';

export default reactApp(import.meta.dirname, {
  setupFiles: ['./src/test-setup.ts'],
  siteUrl,
});
