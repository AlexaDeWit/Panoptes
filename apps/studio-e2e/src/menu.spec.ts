import { expect, test } from '@playwright/test';
import { registeredChords } from './chords.js';
import { savedFromMenu } from './commands.fixtures.js';
import {
  canvasSettled,
  elementNodes,
  menuButton,
  menuItem,
  nodeNamed,
  openFile,
  openMenu,
  openPlaceholder,
  placeByClick,
  runFromMenu,
  withoutPickers,
} from './studio.fixtures.js';

test('the menu shows assigned shortcuts and the project link', async ({
  page,
}) => {
  await openPlaceholder(page);

  await openMenu(page);

  await expect(page.getByRole('menuitem')).toHaveCount(10);
  await expect(
    page.locator('[role="menuitem"][aria-keyshortcuts]'),
  ).toHaveCount(8);
  await expect(menuItem(page, 'Export')).toBeVisible();
  const source = menuItem(page, 'View source on GitHub');
  await expect(source).toHaveAttribute(
    'href',
    'https://github.com/AlexaDeWit/Saerskriven',
  );
  await expect(source).toHaveAttribute('target', '_blank');
  await expect(source.locator('svg')).toHaveAttribute('aria-hidden', 'true');
});

test('save as asks the format in the menu where the browser has no picker of its own', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openPlaceholder(page);

  await openMenu(page);
  await menuItem(page, 'Save as').click();

  await expect(page.getByRole('menuitem')).toHaveCount(11);
  await expect(menuItem(page, 'Save as Saerskriven YAML')).toBeVisible();
  await expect(menuItem(page, 'Save as Threat Dragon JSON')).toBeVisible();
  await expect(menuItem(page, 'Export')).toBeVisible();
  await expect(menuItem(page, 'View source on GitHub')).toBeVisible();

  const written = await savedFromMenu(page, 'Save as Saerskriven YAML');

  expect(written.name).toBe('threat-model.yaml');
  await openMenu(page);
  await expect(page.getByTestId('file-state')).toContainText(written.name);
  await expect(page.getByTestId('file-state')).toContainText(
    'Saerskriven YAML',
  );
});

test('every item is reached, run and left by the keyboard alone', async ({
  page,
}) => {
  await openPlaceholder(page);
  const added = nodeNamed(page, /^New actor, actor/u);
  await placeByClick(page, 'Actor', /^New actor, actor/u);
  await page.keyboard.press('Enter');

  await menuButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(menuItem(page, 'Open a model')).toBeFocused();

  for (const name of ['Save', 'Save as', 'Export', 'Close the file', 'Undo']) {
    await page.keyboard.press('ArrowDown');
    await expect(menuItem(page, name)).toBeFocused();
  }

  await page.keyboard.press('Enter');

  await expect(added).toHaveCount(0);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(menuButton(page)).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(menuItem(page, 'Open a model')).toBeFocused();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(menuButton(page)).toBeFocused();
});

test('the canvas stays live behind the open menu', async ({ page }) => {
  await openPlaceholder(page);

  await openMenu(page);

  await expect(page.getByRole('main')).not.toHaveAttribute('aria-hidden');
  const store = nodeNamed(page, /^Store, store/u);
  await store.click();

  await expect(store).toHaveClass(/selected/u);
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('the button marks unsaved work, and the menu says so in words', async ({
  page,
}) => {
  await openPlaceholder(page);

  await expect(menuButton(page)).toHaveAccessibleName('Menu');

  await placeByClick(page, 'Actor', /^New actor, actor/u);

  await expect(menuButton(page)).toHaveAccessibleName('Menu, unsaved changes');
  await openMenu(page);
  await expect(page.getByTestId('file-state')).toContainText(
    'Saerskriven YAML',
  );
});

test('closing asks in the menu before it drops work that is in no file', async ({
  page,
}) => {
  await openFile(page, 'test-data/saerskriven/ecluse.yaml');
  await expect(elementNodes(page)).toHaveCount(18);
  await placeByClick(page, 'Actor', /^New actor, actor/u);
  await page.keyboard.press('Enter');
  await expect(elementNodes(page)).toHaveCount(19);

  await menuButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(menuItem(page, 'Open a model')).toBeFocused();
  for (const name of ['Save', 'Save as', 'Export', 'Close the file']) {
    await page.keyboard.press('ArrowDown');
    await expect(menuItem(page, name)).toBeFocused();
  }

  await page.keyboard.press('Enter');

  const discard = menuItem(page, 'Discard the changes and close');
  await expect(discard).toBeFocused();
  await expect(elementNodes(page)).toHaveCount(19);

  await page.keyboard.press('ArrowDown');
  await expect(menuItem(page, 'Keep the file open')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(menuButton(page)).toBeFocused();
  await expect(elementNodes(page)).toHaveCount(19);

  await page.keyboard.press(registeredChords['close-file'][0]);
  await expect(discard).toBeVisible();
  await discard.click();

  await canvasSettled(page);
  await expect(nodeNamed(page, /^Actor, actor/u)).toHaveCount(1);
  await openMenu(page);
  await expect(menuButton(page)).not.toHaveAccessibleName(/unsaved changes/u);
});

test('closing a file that holds everything on screen takes no second press', async ({
  page,
}) => {
  await openFile(page, 'test-data/saerskriven/ecluse.yaml');
  await expect(elementNodes(page)).toHaveCount(18);

  await runFromMenu(page, 'Close the file');

  await canvasSettled(page);
  await expect(elementNodes(page)).toHaveCount(2);
  await openMenu(page);
  await expect(menuButton(page)).not.toHaveAccessibleName(/unsaved changes/u);
});

test('the menu chrome carries what a save could not hold, and puts it away again', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openPlaceholder(page);

  await openMenu(page);
  await menuItem(page, 'Save as').click();
  const written = await savedFromMenu(page, 'Save as Threat Dragon JSON');

  expect(written.name).toBe('threat-model.json');
  await expect(page.getByTestId('loss-report')).not.toBeEmpty();

  await page.getByRole('button', { name: 'Dismiss the report' }).click();

  await expect(page.getByTestId('loss-report')).toBeEmpty();
});
