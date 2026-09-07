import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { vendored } from './studio.fixtures.js';

const socialCard = vendored('apps/studio/public/social-card.png');
const manifest = vendored('apps/studio/social-card.sha256');
const sources = [
  'apps/studio/social-card-source.html',
  'apps/studio/public/favicon.svg',
  'packages/canvas/src/lib/tokens.ts',
].map(vendored);

const digest = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

test('the published social card matches its editable source', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto('/social-card-source.html');
  await page.evaluate(() => document.fonts.ready);

  if (testInfo.config.updateSnapshots === 'all') {
    writeFileSync(
      socialCard,
      await page.screenshot({ animations: 'disabled' }),
    );
  }

  const expectedManifest = `${digest(
    Buffer.concat(sources.map((source) => readFileSync(source))),
  )}  source\n${digest(readFileSync(socialCard))}  social-card.png\n`;
  if (testInfo.config.updateSnapshots === 'all') {
    writeFileSync(manifest, expectedManifest);
  }

  expect(readFileSync(manifest, 'utf8')).toBe(expectedManifest);
  expect(await page.locator('.card').boundingBox()).toEqual({
    x: 24,
    y: 24,
    width: 1152,
    height: 582,
  });
});
