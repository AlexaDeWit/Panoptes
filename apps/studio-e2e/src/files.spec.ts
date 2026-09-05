import { expect, test } from '@playwright/test';
import {
  elementNodes,
  nodeNamed,
  openFile,
  savedFile,
  withoutPickers,
} from './studio.fixtures.js';

test('opens a model, saves it back, and writes a file that parses again', async ({
  page,
}) => {
  await openFile(page, 'test-data/ecluse.json');

  await expect(page.getByTestId('file-state')).toHaveText(
    'ecluse.json, Threat Dragon JSON, no unsaved changes',
  );
  await expect(page.getByTestId('element-count')).toHaveText('38');

  const written = await savedFile(page);

  expect(written.name).toBe('ecluse.json');
  expect(JSON.parse(written.text)).toMatchObject({
    version: '2.6.2',
    summary: { title: 'Écluse' },
  });
  await expect(page.getByTestId('loss-report')).toBeEmpty();
});

test('opens the native format by its content, and draws the same diagram', async ({
  page,
}) => {
  await openFile(page, 'test-data/panoptes/ecluse.yaml');

  await expect(page.getByTestId('file-state')).toHaveText(
    'ecluse.yaml, Panoptes YAML, no unsaved changes',
  );
  await expect(elementNodes(page)).toHaveCount(18);
  await expect(page.locator('.react-flow__edge')).toHaveCount(20);
  await expect(nodeNamed(page, /^Operator trust zone/u)).toBeVisible();
  await expect(nodeNamed(page, /^Écluse proxy, process/u)).toBeVisible();
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
