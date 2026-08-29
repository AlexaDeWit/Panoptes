import { expect, test } from '@playwright/test';

// Smoke depth only: the app boots and the canvas container renders. Element
// selection joins this spec when M4 lands it (#38).
test('the studio boots and renders the canvas container', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();
});
