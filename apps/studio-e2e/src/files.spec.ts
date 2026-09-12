import { expect, test } from '@playwright/test';
import {
  closeMenu,
  elementNodes,
  nodeNamed,
  openFile,
  openMenu,
  openText,
  savedFile,
  withoutPickers,
} from './studio.fixtures.js';

test('opens a model, saves it back, and writes a file that parses again', async ({
  page,
}) => {
  await openFile(page, 'test-data/ecluse.json');

  await openMenu(page);
  await expect(page.getByTestId('file-state')).toContainText('ecluse.json');
  await expect(page.getByTestId('file-state')).toContainText(
    'Threat Dragon JSON',
  );
  await closeMenu(page);
  await expect(elementNodes(page)).toHaveCount(18);
  await expect(page.locator('.react-flow__edge')).toHaveCount(20);

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
  await openFile(page, 'test-data/saerskriven/ecluse.yaml');

  await openMenu(page);
  await expect(page.getByTestId('file-state')).toContainText('ecluse.yaml');
  await expect(page.getByTestId('file-state')).toContainText(
    'Saerskriven YAML',
  );
  await closeMenu(page);
  await expect(elementNodes(page)).toHaveCount(18);
  await expect(page.locator('.react-flow__edge')).toHaveCount(20);
  await expect(nodeNamed(page, /^Operator trust zone/u)).toBeVisible();
  await expect(nodeNamed(page, /^Écluse proxy, process/u)).toBeVisible();
});

test('says what it could not read, and stays up', async ({ page }) => {
  await page.addInitScript(withoutPickers);
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await openText(page, 'notes.txt', 'no threat model here');

  await expect(page.getByTestId('failure-notice')).toContainText('notes.txt');
  await expect(page.getByTestId('canvas-container')).toBeVisible();
});
