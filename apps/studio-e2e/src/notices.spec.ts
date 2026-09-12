import { expect, test } from '@playwright/test';
import { openText, withoutPickers } from './studio.fixtures.js';

const refusedYaml = [
  'formatVersion: 1',
  'metadata:',
  '  title: 12',
  'assumptions: every one of them',
  'diagrams: none',
].join('\n');

test('folds several refusal lines, and lists them when the disclosure opens', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await openText(page, 'broken.yaml', refusedYaml);

  const notice = page.getByTestId('failure-notice');
  await expect(notice).toContainText('broken.yaml');
  const disclosure = notice.locator('details');
  await expect(disclosure).toHaveJSProperty('open', false);
  await expect(notice.getByRole('listitem')).toHaveCount(0);

  await disclosure.locator('summary').click();

  await expect(disclosure).toHaveJSProperty('open', true);
  expect(await notice.getByRole('listitem').count()).toBeGreaterThan(1);
});

test('a dismissed refusal leaves the canvas chrome clear, and a later one shows', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await openText(page, 'notes.txt', 'no threat model here');
  await expect(page.getByTestId('failure-notice')).toContainText('notes.txt');

  await page.getByRole('button', { name: 'Dismiss problem' }).click();

  await expect(page.getByTestId('failure-notice')).toBeEmpty();
  await expect(page.getByTestId('loss-report')).toBeEmpty();
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await openText(page, 'second.txt', 'still no threat model');

  await expect(page.getByTestId('failure-notice')).toContainText('second.txt');
});
