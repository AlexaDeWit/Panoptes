import { expect, test } from '@playwright/test';
import { registeredChords } from './chords.js';
import {
  savedByKey,
  savedFromMenu,
  viewportTransform,
} from './commands.fixtures.js';
import {
  beforeCanvas,
  canvasSettled,
  closeMenu,
  elementNodes,
  menuButton,
  menuItem,
  nodeNamed,
  openEcluse,
  openMenu,
  openPlaceholder,
  selectNode,
  threatPanel,
  vendored,
  withoutPickers,
} from './studio.fixtures.js';

test('undo and redo move the history from the keyboard, on either redo chord', async ({
  page,
}) => {
  await openPlaceholder(page);
  const added = nodeNamed(page, /^New actor, actor/u);

  await page.keyboard.press(registeredChords['actor-tool'][0]);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(added).toHaveCount(1);

  await page.keyboard.press(registeredChords.undo[0]);
  await expect(added).toHaveCount(0);

  await page.keyboard.press(registeredChords.redo[0]);
  await expect(added).toHaveCount(1);

  await page.keyboard.press(registeredChords.undo[0]);
  await expect(added).toHaveCount(0);

  await page.keyboard.press(registeredChords.redo[1]);
  await expect(added).toHaveCount(1);
});

test('delete removes the selection from outside the canvas, on either key', async ({
  page,
}) => {
  await openPlaceholder(page);

  await selectNode(page, /^Actor, actor/u);
  await beforeCanvas(page).focus();
  await page.keyboard.press(registeredChords.delete[0]);

  await expect(nodeNamed(page, /^Actor, actor/u)).toHaveCount(0);

  await selectNode(page, /^Store, store/u);
  await beforeCanvas(page).focus();
  await page.keyboard.press(registeredChords.delete[1]);

  await expect(elementNodes(page)).toHaveCount(0);
});

test('escape clears the selection', async ({ page }) => {
  await openPlaceholder(page);
  const actor = await selectNode(page, /^Actor, actor/u);

  await page.keyboard.press(registeredChords['select-tool'][1]);

  await expect(actor).not.toHaveClass(/selected/u);
});

test('zooming and fitting move the viewport and nothing else', async ({
  page,
}) => {
  await openEcluse(page);
  const fitted = await viewportTransform(page);

  await page.keyboard.press(registeredChords['zoom-in'][0]);
  await expect.poll(async () => viewportTransform(page)).not.toBe(fitted);
  const closer = await viewportTransform(page);

  await page.keyboard.press(registeredChords['zoom-out'][0]);
  await expect.poll(async () => viewportTransform(page)).not.toBe(closer);

  await page.keyboard.press(registeredChords['fit-to-view'][0]);
  await expect.poll(async () => viewportTransform(page)).toBe(fitted);

  await expect(elementNodes(page)).toHaveCount(18);
});

test('saving is one chord, and saving as asks the format the browser cannot', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openPlaceholder(page);

  const native = await savedByKey(page, registeredChords.save[0]);

  expect(native.name).toBe('threat-model.yaml');
  expect(native.text).toContain('formatVersion');

  await page.keyboard.press(registeredChords['save-as'][0]);

  const elsewhere = await savedFromMenu(page, 'Save as Threat Dragon JSON');

  expect(elsewhere.name).toBe('threat-model.json');
  expect(JSON.parse(elsewhere.text)).toMatchObject({ version: '2.6.2' });
});

test('opening is one chord, through the picker the browser offers', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openPlaceholder(page);

  const chooser = page.waitForEvent('filechooser');
  await expect(page.getByTestId('file-input')).toHaveCount(1);
  await page.keyboard.press(registeredChords.open[0]);
  await (await chooser).setFiles(vendored('test-data/saerskriven/ecluse.yaml'));

  await expect(page.getByTestId('failure-notice')).toBeEmpty();
  await openMenu(page);
  await expect(page.getByTestId('file-state')).toContainText('ecluse.yaml');
  await expect(page.getByTestId('file-state')).toContainText(
    'Saerskriven YAML',
  );
  await closeMenu(page);
  await canvasSettled(page);
  await expect(elementNodes(page)).toHaveCount(18);
});

test('select all reaches the whole diagram from the keyboard', async ({
  page,
}) => {
  await openPlaceholder(page);

  await page.keyboard.press(registeredChords['select-all'][0]);

  await expect(elementNodes(page)).toHaveCount(2);
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);
  await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1);
  await expect(threatPanel(page)).toContainText('3 elements selected');
});

test('a shortcut waits while a name is being typed, and saving and undo do not', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openPlaceholder(page);
  await selectNode(page, /^Actor, actor/u);
  await threatPanel(page).getByRole('button', { name: 'Add a threat' }).click();
  const title = threatPanel(page).getByRole('textbox', { name: 'Title' });
  await expect(title).toBeFocused();

  await page.keyboard.press(registeredChords['select-all'][0]);
  await page.keyboard.type('actor');
  await page.keyboard.press(registeredChords.delete[0]);

  await expect(title).toHaveValue('actor');
  await expect(elementNodes(page)).toHaveCount(2);

  const written = await savedByKey(page, registeredChords.save[0]);
  expect(written.name).toBe('threat-model.yaml');

  await title.focus();
  await page.keyboard.press(registeredChords.undo[0]);

  await openMenu(page);
  await expect(page.getByTestId('file-state')).toContainText(
    'threat-model.yaml',
  );
  await expect(page.getByTestId('file-state')).toContainText(
    'Saerskriven YAML',
  );
  await expect(menuButton(page)).toHaveAccessibleName(/unsaved changes/u);
  await closeMenu(page);
  await expect(
    threatPanel(page).getByRole('textbox', { name: 'Title' }),
  ).toHaveCount(0);
});

test('escape from a field closes the panel over the draft rather than clearing the selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = await selectNode(page, /^Actor, actor/u);
  await threatPanel(page).getByRole('button', { name: 'Add a threat' }).click();
  const title = threatPanel(page).getByRole('textbox', { name: 'Title' });
  await title.fill('Soft\u00adhyphen');
  await title.press('Enter');
  await expect(title).toHaveAttribute('aria-invalid', 'true');

  await title.press(registeredChords['select-tool'][1]);

  await expect(threatPanel(page)).toHaveCount(0);
  await expect(actor).toHaveClass(/selected/u);
  await expect(actor).toBeFocused();

  await page.keyboard.press(registeredChords['focus-threats'][0]);
  const held = threatPanel(page).getByRole('textbox', { name: 'Title' });

  await expect(held).toHaveValue('Soft\u00adhyphen');
  await expect(held).toHaveAttribute('aria-invalid', 'true');
});

test('every control says which key runs it: beside a menu item, and as a note beside a bare button', async ({
  page,
}) => {
  await openPlaceholder(page);

  const actor = page.getByRole('button', { name: 'Actor', exact: true });
  await actor.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Actor A or 2');
  await expect(actor).toHaveAttribute('aria-keyshortcuts', 'A 2');

  await openMenu(page);

  await expect(menuItem(page, 'Save')).toBeVisible();
  await expect(menuItem(page, 'Save')).toHaveAttribute(
    'aria-keyshortcuts',
    'Control+S',
  );
  await expect(menuItem(page, 'Undo')).toHaveAttribute(
    'aria-keyshortcuts',
    'Control+Z',
  );
});
