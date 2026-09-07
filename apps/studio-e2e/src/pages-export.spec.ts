import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  expectedPdfDigest,
  pdfDigest,
  pdfPageCount,
} from './exports.fixtures.js';
import { exportedFile, openFile } from './studio.fixtures.js';

const socialImage = 'https://alexadewit.github.io/Saerskriven/social-card.png';
const socialImageAlt =
  'Saerskriven: Draw the system. Record the threats. An example threat model connects a maintainer, studio, and model file.';

test('the Pages build loads its hashed PDF assets below the site base', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openFile(page, 'test-data/ecluse.json', './');

  const output = await exportedFile(page, 'Model as PDF');

  expect(output.name).toBe('ecluse.pdf');
  expect(pdfPageCount(output.bytes)).toBe(14);
  expect(pdfDigest(output.bytes)).toBe(expectedPdfDigest);
});

test('the Pages build publishes the social card and its text alternative', async ({
  page,
}) => {
  await page.goto('./');

  const property = (name: string) =>
    page.locator(`meta[property="${name}"]`).getAttribute('content');
  const named = (name: string) =>
    page.locator(`meta[name="${name}"]`).getAttribute('content');

  expect(await property('og:image')).toBe(socialImage);
  expect(await property('og:image:type')).toBe('image/png');
  expect(await property('og:image:width')).toBe('1200');
  expect(await property('og:image:height')).toBe('630');
  expect(await property('og:image:alt')).toBe(socialImageAlt);
  expect(await named('twitter:card')).toBe('summary_large_image');
  expect(await named('twitter:image')).toBe(socialImage);
  expect(await named('twitter:image:alt')).toBe(socialImageAlt);

  const response = await page.request.get(
    new URL('social-card.png', page.url()).href,
  );
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/png');
  expect(await response.body()).toEqual(
    readFileSync(join(__dirname, '../../studio/public/social-card.png')),
  );
});
