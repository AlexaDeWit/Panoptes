import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  expectedPdfDigest,
  pdfDigest,
  pdfPageCount,
} from './exports.fixtures.js';
import { exportedFile, openFile, vendored } from './studio.fixtures.js';

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
  const png = await response.body();
  expect(png.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});

test('the release build identifies its own version and release notes', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: /^Menu/u }).click();
  const notes = page.getByRole('menuitem', {
    name: /^Saerskriven [0-9]+\.[0-9]+\.[0-9]+ release notes$/u,
  });
  const href = (await notes.getAttribute('href')) ?? '';
  const version = href.replace(
    'https://github.com/AlexaDeWit/Saerskriven/releases/tag/v',
    '',
  );
  const manifest: unknown = JSON.parse(
    readFileSync(vendored('package.json'), 'utf8'),
  );
  expect(manifest).toMatchObject({ version });
  await notes.focus();
  await expect(notes).toBeFocused();
  const response = await page.request.get(
    new URL('version.json', page.url()).href,
  );
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ version, tag: `v${version}` });
});
