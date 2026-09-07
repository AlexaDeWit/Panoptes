import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const socialCard = join(__dirname, '../../studio/public/social-card.png');

const digest = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

test('the published social card matches its editable source', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto('/social-card-source.html');
  await page.evaluate(() => document.fonts.ready);

  const rendered = await page.screenshot({ animations: 'disabled' });
  if (testInfo.config.updateSnapshots === 'all') {
    writeFileSync(socialCard, rendered);
  }

  expect(digest(rendered)).toBe(digest(readFileSync(socialCard)));
});
