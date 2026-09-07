import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { exportedFile, openFile, vendored } from './studio.fixtures.js';

const golden = (name: string): Buffer =>
  readFileSync(vendored(`test-data/render/${name}`));

const digest = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

const expectedPdfDigest = (): string =>
  readFileSync(
    vendored('test-data/render/ecluse.snapshot.pdf.sha256'),
    'utf8',
  ).trim();

const pageTree = /\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/u;

const pageCount = (pdf: Uint8Array): number => {
  const counted = pageTree.exec(Buffer.from(pdf).toString('latin1'));
  return counted === null ? 0 : Number(counted[1]);
};

test.beforeEach(async ({ page }) => {
  await openFile(page, 'test-data/ecluse.json');
});

test('exports the CLI drawing byte for byte', async ({ page }) => {
  const output = await exportedFile(page, 'Diagram as SVG');

  expect(output.name).toBe('ecluse.svg');
  expect(output.bytes).toEqual(golden('ecluse.snapshot.svg'));
});

test('exports the CLI register byte for byte', async ({ page }) => {
  const output = await exportedFile(page, 'Register as Markdown');

  expect(output.name).toBe('ecluse.md');
  expect(output.bytes).toEqual(golden('ecluse.register.snapshot.md'));
});

test('exports the Typst source used by the CLI byte for byte', async ({
  page,
}) => {
  const output = await exportedFile(page, 'Model as Typst');

  expect(output.name).toBe('ecluse.typ');
  expect(output.bytes).toEqual(golden('ecluse.snapshot.typ'));
});

test('exports the same deterministic PDF as the CLI', async ({ page }) => {
  test.setTimeout(60_000);

  const output = await exportedFile(page, 'Model as PDF');

  expect(output.name).toBe('ecluse.pdf');
  expect(output.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(pageCount(output.bytes)).toBe(14);
  expect(digest(output.bytes)).toBe(expectedPdfDigest());
});
