import { reactApp } from '../../vite.shared.mts';
import { typstAssets } from './typst-assets.mjs';

const siteUrl =
  process.env['PAGES_SITE_URL'] ?? 'https://alexadewit.github.io/Saerskriven';
const pagesBasePath = process.env['PAGES_BASE_PATH'];
const base =
  pagesBasePath === undefined
    ? undefined
    : `${pagesBasePath.replace(/\/+$/u, '')}/`;

type StudioConfigOptions = {
  readonly cacheDirectory?: string;
  readonly outDirectory?: string;
};

export const studioConfig = (options: StudioConfigOptions = {}) =>
  reactApp(import.meta.dirname, {
    base,
    plugins: [typstAssets()],
    setupFiles: ['./src/test-setup.ts'],
    siteUrl,
    ...options,
  });

export default studioConfig();
