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
  runFromMenu,
  withoutPickers,
} from './studio.fixtures.js';

test('the menu holds the file and edit commands, each showing its shortcut', async ({
  page,
}) => {
  await openPlaceholder(page);

  await openMenu(page);

  await expect(page.getByRole('menuitem')).toHaveText([
    'Open a modelCtrl+O',
    'SaveCtrl+S',
    'Save asCtrl+Shift+S',
    'Close the fileCtrl+Shift+X',
    'UndoCtrl+Z',
    'RedoCtrl+Shift+Z or Ctrl+Y',
    'Rename the selectionF2',
    'Delete the selectionDelete or Backspace',
  ]);
});

test('save as asks the format in the menu where the browser has no picker of its own', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openPlaceholder(page);

  await openMenu(page);
  await menuItem(page, 'Save as').click();

  await expect(page.getByRole('menuitem')).toHaveText([
    'Open a modelCtrl+O',
    'SaveCtrl+S',
    'Save as Panoptes YAML',
    'Save as Threat Dragon JSON',
    'Close the fileCtrl+Shift+X',
    'UndoCtrl+Z',
    'RedoCtrl+Shift+Z or Ctrl+Y',
    'Rename the selectionF2',
    'Delete the selectionDelete or Backspace',
  ]);

  const written = await savedFromMenu(page, 'Save as Panoptes YAML');

  expect(written.name).toBe('threat-model.yaml');
  await openMenu(page);
  await expect(page.getByTestId('file-state')).toHaveText(
    'threat-model.yaml, Panoptes YAML, no unsaved changes',
  );
});

test('every item is reached, run and left by the keyboard alone', async ({
  page,
}) => {
  await openPlaceholder(page);
  const added = nodeNamed(page, /^New actor, actor/u);
  await page.getByRole('button', { name: 'New actor', exact: true }).click();
  await expect(added).toHaveCount(1);

  await menuButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(menuItem(page, 'Open a model')).toBeFocused();

  for (const name of ['Save', 'Save as', 'Close the file', 'Undo']) {
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
  const studio = nodeNamed(page, /^Studio, process/u);
  await studio.click();

  await expect(studio).toHaveClass(/selected/u);
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('the button marks unsaved work, and the menu says so in words', async ({
  page,
}) => {
  await openPlaceholder(page);

  await expect(menuButton(page)).toHaveAccessibleName('Menu');

  await page.getByRole('button', { name: 'New actor', exact: true }).click();

  await expect(menuButton(page)).toHaveAccessibleName('Menu, unsaved changes');
  await openMenu(page);
  await expect(page.getByTestId('file-state')).toHaveText(
    'No file, Panoptes YAML, unsaved changes',
  );
});

test('closing asks in the menu before it drops work that is in no file', async ({
  page,
}) => {
  await openFile(page, 'test-data/panoptes/ecluse.yaml');
  await expect(elementNodes(page)).toHaveCount(18);
  await page.getByRole('button', { name: 'New actor', exact: true }).click();
  await expect(elementNodes(page)).toHaveCount(19);

  await menuButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(menuItem(page, 'Open a model')).toBeFocused();
  for (const name of ['Save', 'Save as', 'Close the file']) {
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
  await expect(nodeNamed(page, /^Reader, actor/u)).toHaveCount(1);
  await openMenu(page);
  await expect(page.getByTestId('file-state')).toHaveText(
    'No file, Panoptes YAML, no unsaved changes',
  );
});

test('closing a file that holds everything on screen takes no second press', async ({
  page,
}) => {
  await openFile(page, 'test-data/panoptes/ecluse.yaml');
  await expect(elementNodes(page)).toHaveCount(18);

  await runFromMenu(page, 'Close the file');

  await canvasSettled(page);
  await expect(elementNodes(page)).toHaveCount(2);
  await openMenu(page);
  await expect(page.getByTestId('file-state')).toHaveText(
    'No file, Panoptes YAML, no unsaved changes',
  );
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
  await expect(page.getByTestId('loss-report')).toContainText(
    'The last save did not carry everything the model holds:',
  );

  await page.getByRole('button', { name: 'Dismiss the report' }).click();

  await expect(page.getByTestId('loss-report')).toBeEmpty();
});
