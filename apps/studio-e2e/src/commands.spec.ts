import { expect, test } from '@playwright/test';
import {
  chordsWaitingOnASurface,
  registeredChords,
  savedByKey,
  shortcutShown,
  viewportTransform,
} from './commands.fixtures.js';
import {
  beforeCanvas,
  canvasSettled,
  elementNodes,
  nodeNamed,
  openEcluse,
  openPlaceholder,
  selectNode,
  threatPanel,
  vendored,
  withoutPickers,
} from './studio.fixtures.js';

const drawn = [
  [registeredChords['actor-tool'][0], /^New actor, actor/u],
  [registeredChords['process-tool'][0], /^New process, process/u],
  [registeredChords['store-tool'][0], /^New store, store/u],
  [registeredChords['boundary-box-tool'][0], /^New trust boundary, trust/u],
  [registeredChords['boundary-curve-tool'][0], /^New trust boundary curve/u],
] as const;

test('each tool key draws the element its palette control draws', async ({
  page,
}) => {
  await openPlaceholder(page);

  for (const [chord] of drawn) {
    await page.keyboard.press(chord);
  }

  for (const [, named] of drawn) {
    await expect(nodeNamed(page, named)).toHaveCount(1);
  }
  await expect(elementNodes(page)).toHaveCount(7);
});

test('undo and redo move the history from the keyboard, on either redo chord', async ({
  page,
}) => {
  await openPlaceholder(page);
  const added = nodeNamed(page, /^New actor, actor/u);

  await page.keyboard.press(registeredChords['actor-tool'][0]);
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

  await selectNode(page, /^Reader, actor/u);
  await beforeCanvas(page).focus();
  await page.keyboard.press(registeredChords.delete[0]);

  await expect(nodeNamed(page, /^Reader, actor/u)).toHaveCount(0);

  await selectNode(page, /^Studio, process/u);
  await beforeCanvas(page).focus();
  await page.keyboard.press(registeredChords.delete[1]);

  await expect(elementNodes(page)).toHaveCount(0);
});

test('escape clears the selection', async ({ page }) => {
  await openPlaceholder(page);
  const reader = await selectNode(page, /^Reader, actor/u);

  await page.keyboard.press(registeredChords['clear-selection'][0]);

  await expect(reader).not.toHaveClass(/selected/u);
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

test('saving and saving elsewhere are one chord each', async ({ page }) => {
  await page.addInitScript(withoutPickers);
  await openPlaceholder(page);

  const native = await savedByKey(page, registeredChords.save[0]);

  expect(native.name).toBe('threat-model.yaml');
  expect(native.text).toContain('formatVersion');

  const elsewhere = await savedByKey(page, registeredChords['save-as'][0]);

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
  await (await chooser).setFiles(vendored('test-data/panoptes/ecluse.yaml'));

  await expect(page.getByTestId('failure-notice')).toBeEmpty();
  await expect(page.getByTestId('file-state')).toHaveText(
    'ecluse.yaml, Panoptes YAML, no unsaved changes',
  );
  await canvasSettled(page);
  await expect(elementNodes(page)).toHaveCount(18);
});

test('a command still waiting on its surface claims its chord and changes nothing', async ({
  page,
}) => {
  await openPlaceholder(page);
  const reader = await selectNode(page, /^Reader, actor/u);
  const settled = await viewportTransform(page);

  for (const chord of chordsWaitingOnASurface) {
    await page.keyboard.press(chord);
  }

  await expect(elementNodes(page)).toHaveCount(2);
  await expect(reader).toHaveClass(/selected/u);
  await expect(page.getByTestId('file-state')).toHaveText(
    'No file, Panoptes YAML, no unsaved changes',
  );
  expect(await viewportTransform(page)).toBe(settled);
});

test('a shortcut waits while a name is being typed, and saving and undo do not', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openPlaceholder(page);
  await selectNode(page, /^Reader, actor/u);
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

  await expect(page.getByTestId('file-state')).toHaveText(
    'threat-model.yaml, Panoptes YAML, unsaved changes',
  );
  await expect(
    threatPanel(page).getByRole('textbox', { name: 'Title' }),
  ).toHaveCount(0);
});

test('every control says which key runs it, to a pointer and to a reader alike', async ({
  page,
}) => {
  await openPlaceholder(page);

  const save = await shortcutShown(
    page,
    page.getByRole('button', { name: 'Save', exact: true }),
  );
  expect(save).toEqual({
    tooltip: 'Ctrl+S',
    keyShortcuts: 'Control+S',
    description: 'Shortcut: Ctrl+S',
  });

  const undo = await shortcutShown(
    page,
    page.getByRole('button', { name: 'Undo' }),
  );
  expect(undo.keyShortcuts).toBe('Control+Z');

  const actor = await shortcutShown(
    page,
    page.getByRole('button', { name: 'New actor', exact: true }),
  );
  expect(actor).toEqual({
    tooltip: 'A',
    keyShortcuts: 'A',
    description: 'Shortcut: A',
  });
});
