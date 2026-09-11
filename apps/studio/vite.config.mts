import { versionDefine, workspaceVersion } from '../../workspace-version.mts';
import { reactApp } from '../../vite.shared.mts';
import {
  initialColourModeScript,
  initialPageStylesheet,
} from './initial-page.mjs';
import { socialCardAsset, socialImage } from './social-card.mjs';
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

const versionStamp = () => {
  const version = workspaceVersion();
  const tag = process.env['SAERSKRIVEN_RELEASE_TAG'] ?? '';
  const build = process.env['GITHUB_SHA'] ?? 'development';
  return {
    name: 'studio-version',
    config: () => ({
      define: {
        ...versionDefine(),
        SAERSKRIVEN_RELEASE_TAG: JSON.stringify(tag),
        SAERSKRIVEN_BUILD_ID: JSON.stringify(build),
      },
    }),
    buildStart() {
      if (tag !== '' && tag !== `v${version}`) {
        this.error(
          `Release tag ${tag} disagrees with workspace version ${version}.`,
        );
      }
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version, tag }),
      });
    },
  } satisfies import('vite').Plugin;
};

export const studioConfig = (options: StudioConfigOptions = {}) =>
  reactApp(import.meta.dirname, {
    base,
    plugins: [
      versionStamp(),
      initialPageStyles(),
      typstAssets(),
      socialCardAsset(),
    ],
    setupFiles: ['./src/test-setup.ts'],
    siteUrl,
    socialImage,
    ...options,
  });

export default studioConfig();
