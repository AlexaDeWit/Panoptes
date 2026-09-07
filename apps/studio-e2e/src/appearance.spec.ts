import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openMenu, openPlaceholder } from './studio.fixtures.js';

const appearance = (page: Page) =>
  page.getByRole('menuitem', { name: /^Appearance /u });

const chooseAppearance = async (
  page: Page,
  mode: 'System' | 'Light' | 'Dark',
): Promise<void> => {
  await openMenu(page);
  await appearance(page).press('ArrowRight');
  await page.getByRole('menuitemradio', { name: mode }).click();
};

const audit = async (page: Page): Promise<void> => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id }) => id)).toEqual([]);
};

test('selects each appearance mode and persists explicit choices', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openPlaceholder(page);

  await chooseAppearance(page, 'System');
  await expect(page.locator('html')).not.toHaveAttribute('data-pn-colour-mode');

  await chooseAppearance(page, 'Light');
  await expect(page.locator('html')).toHaveAttribute(
    'data-pn-colour-mode',
    'light',
  );
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await openMenu(page);
  await expect(appearance(page)).toHaveText('AppearanceLight');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute(
    'data-pn-colour-mode',
    'light',
  );

  await chooseAppearance(page, 'Dark');
  await expect(page.locator('html')).toHaveAttribute(
    'data-pn-colour-mode',
    'dark',
  );
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await openMenu(page);
  await expect(appearance(page)).toHaveText('AppearanceDark');
  await audit(page);
});

test('invalid stored appearance returns to System', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('saerskrivenColourMode', 'broken');
  });
  await openPlaceholder(page);
  await openMenu(page);

  await expect(appearance(page)).toHaveText('AppearanceSystem');
  await expect(page.locator('html')).not.toHaveAttribute('data-pn-colour-mode');
});

test('explicit light and dark modes pass the accessibility audit', async ({
  page,
}) => {
  await openPlaceholder(page);

  for (const mode of ['Light', 'Dark'] as const) {
    await chooseAppearance(page, mode);
    await audit(page);
  }
});
