import { reactApp } from '../../vite.shared.mts';
import {
  initialColourModeScript,
  initialPageStylesheet,
} from './initial-page.mjs';
import { typstAssets } from './typst-assets.mjs';

const siteUrl =
  process.env['PAGES_SITE_URL'] ?? 'https://alexadewit.github.io/Saerskriven';
const socialImage = {
  alt: 'Saerskriven: Draw the system. Record the threats. An example threat model connects a maintainer, studio, and model file.',
  height: 630,
  path: 'social-card.png',
  width: 1200,
} as const;
const pagesBasePath = process.env['PAGES_BASE_PATH'];
const base =
  pagesBasePath === undefined
    ? undefined
    : `${pagesBasePath.replace(/\/+$/u, '')}/`;

type StudioConfigOptions = {
  readonly cacheDirectory?: string;
  readonly outDirectory?: string;
};

const initialPageStyles = () => ({
  name: 'initial-page-styles',
  transformIndexHtml: () => [
    {
      tag: 'script',
      attrs: { 'data-initial-colour-mode': '' },
      children: initialColourModeScript,
      injectTo: 'head-prepend' as const,
    },
    {
      tag: 'style',
      attrs: { 'data-studio-theme': '' },
      children: initialPageStylesheet,
      injectTo: 'head-prepend' as const,
    },
  ],
});

export const studioConfig = (options: StudioConfigOptions = {}) =>
  reactApp(import.meta.dirname, {
    base,
    plugins: [initialPageStyles(), typstAssets()],
    setupFiles: ['./src/test-setup.ts'],
    siteUrl,
    socialImage,
    ...options,
  });

export default studioConfig();
