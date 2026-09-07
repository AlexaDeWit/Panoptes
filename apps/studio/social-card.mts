import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { tokenStylesheet } from '@saerskriven/canvas/tokens';
import { typstFontAssets } from '@saerskriven/render/build-assets';
import type { Plugin } from 'vite';
import { refuseStudioBuild } from './typst-assets.mjs';

/** The social image metadata and emitted asset name. */
export const socialImage = {
  alt: 'Saerskriven: Draw the system. Record the threats. An example threat model connects a maintainer, studio, and model file.',
  height: 630,
  path: 'social-card.png',
  width: 1200,
} as const;

const sourcePath = join(import.meta.dirname, 'social-card-source.html');
const faviconPath = join(import.meta.dirname, 'public/favicon.svg');

const dataUrl = (mime: string, bytes: Uint8Array): string =>
  `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;

const fontFace = (weight: number, bytes: Uint8Array): string => `
@font-face {
  font-family: 'Saerskriven Social Card';
  font-style: normal;
  font-weight: ${String(weight)};
  src: url('${dataUrl('font/ttf', bytes)}') format('truetype');
}`;

const sourceDocument = async (): Promise<string> => {
  const fonts = typstFontAssets(refuseStudioBuild);
  const font = (name: string) =>
    fonts.find((asset) => asset.name === name)?.from ??
    refuseStudioBuild(`The social card font list holds no ${name}.`);
  const [source, favicon, regular, bold] = await Promise.all([
    readFile(sourcePath, 'utf8'),
    readFile(faviconPath),
    readFile(font('LiberationSans-Regular.ttf')),
    readFile(font('LiberationSans-Bold.ttf')),
  ]);
  const styles = `${tokenStylesheet}
${fontFace(400, regular)}
${fontFace(700, bold)}
:root { --pn-font-family: 'Saerskriven Social Card', sans-serif; }`;

  return source
    .replace(
      '</head>',
      `<style data-social-card-build>${styles}</style></head>`,
    )
    .replace('/favicon.svg', dataUrl('image/svg+xml', favicon));
};

const renderSocialCard = async (): Promise<Buffer> => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: socialImage.width, height: socialImage.height },
    });
    await page.setContent(await sourceDocument(), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return await page.screenshot({ animations: 'disabled' });
  } finally {
    await browser.close();
  }
};

/** Renders the editable social card source into the studio build. */
export function socialCardAsset(): Plugin {
  return {
    name: 'saerskriven-social-card',
    apply: 'build',
    async generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: socialImage.path,
        source: await renderSocialCard(),
      });
    },
  };
}
