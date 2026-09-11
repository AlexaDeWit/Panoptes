import { AxeBuilder } from '@axe-core/playwright';
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
  await page.keyboard.press(registeredChords['shortcut-reference'][0]);
  await expect(title).toHaveValue('actor?');
  await expect(
    page.getByRole('region', { name: 'Keyboard shortcuts' }),
  ).toHaveCount(0);
  await page.keyboard.press(registeredChords['shortcut-reference'][1]);
  await expect(
    page.getByRole('region', { name: 'Keyboard shortcuts' }),
  ).toHaveCount(0);
  await page.keyboard.press(registeredChords.delete[0]);

  await expect(title).toHaveValue('actor?');
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

test('the complete shortcut reference opens by menu or key and returns focus', async ({
  page,
}) => {
  await openPlaceholder(page);
  await openMenu(page);
  const entry = menuItem(page, 'Keyboard shortcuts');

  await expect(entry).toHaveText(/\? or F1/u);
  await expect(entry).toHaveAttribute('aria-keyshortcuts', '? F1');
  await entry.click();

  const reference = page.getByRole('region', { name: 'Keyboard shortcuts' });
  const heading = reference.getByRole('heading', {
    level: 2,
    name: 'Keyboard shortcuts',
  });
  await expect(reference).toBeVisible();
  await expect(heading).toBeFocused();
  const categoryBoxes = async () =>
    reference.locator('h3 > button').evaluateAll((buttons) =>
      buttons.map((button) => {
        const { x, width } = button.getBoundingClientRect();
        return { x: Math.round(x), width: Math.round(width) };
      }),
    );
  const initialCategoryBoxes = await categoryBoxes();
  expect(new Set(initialCategoryBoxes.map(({ x }) => x)).size).toBe(1);
  expect(new Set(initialCategoryBoxes.map(({ width }) => width)).size).toBe(1);
  const fileCategory = reference.getByRole('button', {
    name: 'File',
    exact: true,
  });
  await expect(fileCategory).toHaveAttribute('aria-expanded', 'false');
  await page.screenshot({
    path: test.info().outputPath('shortcut-categories.png'),
  });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(fileCategory).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(fileCategory).toHaveAttribute('aria-expanded', 'true');
  await expect(
    reference.locator('[data-command-id="save"]').getByText('Ctrl+S'),
  ).toBeVisible();
  await reference
    .getByRole('button', { name: 'Canvas navigation', exact: true })
    .click();
  await expect(
    reference.locator('[data-contextual-id="edit-canvas-text"]'),
  ).toBeVisible();
  const categoryButtons = reference.locator('h3 > button');
  for (let index = 0; index < (await categoryButtons.count()); index += 1) {
    const category = categoryButtons.nth(index);
    if ((await category.getAttribute('aria-expanded')) === 'false') {
      await category.click();
    }
  }
  expect(await categoryBoxes()).toEqual(initialCategoryBoxes);

  const audit = await new AxeBuilder({ page })
    .include('[data-testid="shortcut-reference"]')
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(reference).toHaveCount(0);
  await expect(menuButton(page)).toBeFocused();

  await page.setViewportSize({ width: 480, height: 720 });
  await page.keyboard.press(registeredChords['shortcut-reference'][1]);
  await expect(reference).toBeVisible();
  const narrowPanel = await reference.boundingBox();
  expect(narrowPanel?.height).toBeLessThanOrEqual(432);
  expect(narrowPanel?.y).toBeGreaterThan(250);
  await reference
    .getByRole('button', { name: 'Canvas navigation', exact: true })
    .click();
  expect(
    await reference.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath('shortcut-narrow.png'),
  });
  await page.keyboard.press(registeredChords['shortcut-reference'][0]);
  await expect(reference).toHaveCount(0);
});

test('shortcut alternatives stack without squeezing the action label', async ({
  page,
}) => {
  await openPlaceholder(page);
  await page.keyboard.press('F1');
  const reference = page.getByRole('region', { name: 'Keyboard shortcuts' });
  for (const name of [
    'Canvas editing',
    'Canvas navigation',
    'Edit',
    'Flow route',
  ]) {
    await reference.getByRole('button', { name, exact: true }).click();
  }

  for (const width of [1280, 480, 320]) {
    await page.setViewportSize({ width, height: 720 });
    const move = reference.locator('[data-contextual-id="move-selection"]');
    const row = await move.boundingBox();
    const label = await move.locator(':scope > span').first().boundingBox();
    expect(row).not.toBeNull();
    expect(label?.width).toBeGreaterThan((row?.width ?? 0) / 2);

    for (const selector of [
      '[data-contextual-id="select-canvas-item"]',
      '[data-command-id="redo"]',
      '[data-contextual-id="choose-bend-segment"]',
    ]) {
      const keys = reference.locator(selector).locator('kbd');
      await expect(keys).toHaveCount(2);
      const first = await keys.nth(0).boundingBox();
      const second = await keys.nth(1).boundingBox();
      expect(first).not.toBeNull();
      expect(second?.y).toBeGreaterThanOrEqual(
        (first?.y ?? 0) + (first?.height ?? 0),
      );
    }
    expect(
      await reference.evaluate((node) =>
        [...node.querySelectorAll('li, kbd')].every(
          (entry) => entry.scrollWidth <= entry.clientWidth,
        ),
      ),
    ).toBe(true);
    await move.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath(`shortcut-editing-${String(width)}.png`),
    });
  }
});

test('macOS uses Command shortcuts and Shift-Command-Z for redo', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel' });
    Object.defineProperty(navigator, 'userAgentData', {
      value: { platform: 'macOS' },
    });
  });
  await openPlaceholder(page);
  await openMenu(page);
  await expect(menuItem(page, 'Undo')).toHaveAttribute(
    'aria-keyshortcuts',
    'Meta+Z',
  );
  await expect(menuItem(page, 'Redo')).toHaveAttribute(
    'aria-keyshortcuts',
    'Shift+Meta+Z',
  );
  await expect(menuItem(page, 'Save')).toHaveAttribute(
    'aria-keyshortcuts',
    'Meta+S',
  );
  await expect(menuItem(page, 'Copy')).toHaveCount(0);
  await expect(menuItem(page, 'Delete selection')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('mac-menu.png') });
  await closeMenu(page);
  await page.getByRole('application', { name: 'Diagram' }).focus();

  await page.keyboard.press('p');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const added = nodeNamed(page, /^New process, process/u);
  await expect(added).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(added).toHaveCount(1);
  await page.keyboard.press('Meta+z');
  await expect(added).toHaveCount(0);
  await page.keyboard.press('Meta+y');
  await expect(added).toHaveCount(0);
  await page.keyboard.press('Meta+Shift+z');
  await expect(added).toHaveCount(1);
  await added.focus();
  await page.keyboard.press('Backspace');
  await expect(added).toHaveCount(0);
  await page.keyboard.press('Meta+z');
  await expect(added).toHaveCount(1);
  const beforeZoom = await viewportTransform(page);
  await page.keyboard.press('Meta+-');
  await expect.poll(() => viewportTransform(page)).not.toBe(beforeZoom);
  const zoomedOut = await viewportTransform(page);
  await page.keyboard.press('Meta+Shift++');
  await expect.poll(() => viewportTransform(page)).not.toBe(zoomedOut);
  const flow = nodeNamed(page, /^Records, flow/u);
  await flow.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Meta+Shift+!');
  await expect(
    page
      .getByRole('region', { name: 'Flow endpoint' })
      .getByRole('combobox', { name: 'Source' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Meta+Shift+@');
  await expect(
    page
      .getByRole('region', { name: 'Flow endpoint' })
      .getByRole('combobox', { name: 'Target' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await page.keyboard.press('?');
  const reference = page.getByRole('region', { name: 'Keyboard shortcuts' });
  await reference.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(reference.locator('[data-command-id="redo"] kbd')).toHaveText(
    '⇧⌘Z',
  );
  await expect(reference.locator('[data-command-id="delete"]')).toBeVisible();
});
