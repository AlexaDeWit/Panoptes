import { expect, test } from '@playwright/test';
import {
  expectedPdfDigest,
  pdfDigest,
  pdfPageCount,
} from './exports.fixtures.js';
import { exportedFile, openFile } from './studio.fixtures.js';

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
