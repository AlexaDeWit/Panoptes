import { expect, test } from '@playwright/test';
import { exportGolden } from './exports.fixtures.js';
import { exportedFile, openFile } from './studio.fixtures.js';

test.beforeEach(async ({ page }) => {
  await openFile(page, 'test-data/ecluse.json');
});

test('exports the CLI drawing byte for byte', async ({ page }) => {
  const output = await exportedFile(page, 'Diagram as SVG');

  expect(output.name).toBe('ecluse.svg');
  expect(output.bytes).toEqual(exportGolden('ecluse.snapshot.svg'));
});

test('exports the CLI picture byte for byte', async ({ page }) => {
  test.setTimeout(60_000);

  const output = await exportedFile(page, 'Diagram as PNG');

  expect(output.name).toBe('ecluse.png');
  expect(output.bytes).toEqual(exportGolden('ecluse.snapshot.png'));
});

test('exports the CLI register byte for byte', async ({ page }) => {
  const output = await exportedFile(page, 'Register as Markdown');

  expect(output.name).toBe('ecluse.md');
  expect(output.bytes).toEqual(exportGolden('ecluse.register.snapshot.md'));
});

test('exports the Typst source used by the CLI byte for byte', async ({
  page,
}) => {
  const output = await exportedFile(page, 'Model as Typst');

  expect(output.name).toBe('ecluse.typ');
  expect(output.bytes).toEqual(exportGolden('ecluse.snapshot.typ'));
});
