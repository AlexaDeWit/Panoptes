import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The studio is driven through its fallback paths here: Playwright cannot
// operate the native pickers the File System Access API opens, so the two
// entry points are removed before the page loads and the app falls back to
// its own file input and to a download, which is what a browser without that
// API does.
const withoutPickers = (): void => {
  Reflect.deleteProperty(globalThis, 'showOpenFilePicker');
  Reflect.deleteProperty(globalThis, 'showSaveFilePicker');
};

// From this directory, apps/studio-e2e/src, up to the repository root.
const vendored = (path: string): string =>
  join(test.info().project.testDir, '../../..', path);

test('opens a model, saves it back, and writes a file that parses again', async ({
  page,
}) => {
  // Écluse is the largest model the repository vendors, and a cold dev server
  // compiles the codecs on the first request for them, so this one test gets
  // the longer budget rather than the whole suite getting it.
  test.slow();
  await page.addInitScript(withoutPickers);
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await page
    .getByTestId('file-input')
    .setInputFiles(vendored('test-data/ecluse.json'));

  await expect(page.getByTestId('file-state')).toHaveText(
    'ecluse.json, Threat Dragon JSON, no unsaved changes',
  );
  await expect(page.getByTestId('element-count')).toHaveText('38');
  await expect(page.getByTestId('failure-notice')).toBeEmpty();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save', exact: true }).click(),
  ]);

  expect(download.suggestedFilename()).toBe('ecluse.json');
  const written: unknown = JSON.parse(
    readFileSync(await download.path(), 'utf8'),
  );
  expect(written).toMatchObject({
    version: '2.6.2',
    summary: { title: 'Écluse' },
  });
  await expect(page.getByTestId('save-report')).toBeEmpty();
});

test('says what it could not read, and stays up', async ({ page }) => {
  await page.addInitScript(withoutPickers);
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await page.getByTestId('file-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('no threat model here'),
  });

  await expect(page.getByTestId('failure-notice')).toContainText(
    'No format claimed notes.txt.',
  );
  await expect(page.getByTestId('canvas-container')).toBeVisible();
});
