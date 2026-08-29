import { expect, test } from '@playwright/test';

test('the studio boots and renders the canvas container', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();
});
