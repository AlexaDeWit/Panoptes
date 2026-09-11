import { expect, test, type Locator, type Page } from '@playwright/test';
import { registeredChords } from './chords.js';
import {
  canvasSurface,
  dragOnto,
  menuButton,
  nodeNamed,
  openEcluse,
  openPlaceholder,
  runFromMenu,
  selectByKeyboard,
  selectNode,
} from './studio.fixtures.js';

const rename = (page: Page, was: string): Locator =>
  page.getByRole('textbox', { name: `Name of ${was}` });

const drawnName = (element: Locator, run: string): Locator =>
  element.locator(`text.${run}`);

const drawFlow = async (page: Page): Promise<void> => {
  const actor = nodeNamed(page, /^Actor, actor/u);
  await actor.hover();
  await dragOnto(
    page,
    actor.locator('[data-handleid="right"]'),
    nodeNamed(page, /^Store, store/u).locator('[data-handleid="left"]'),
  );
  await expect(nodeNamed(page, /^New flow, flow/u)).toHaveCount(1);
};

test('a store is renamed by double-clicking it, and undo puts the name back', async ({
  page,
}) => {
  await openPlaceholder(page);
  const store = nodeNamed(page, /^Store, store/u);

  await store.dblclick();
  await rename(page, 'Store').fill('Ledger');
  await rename(page, 'Store').press('Enter');

  const renamed = nodeNamed(page, /^Ledger, store/u);
  await expect(renamed).toHaveCount(1);
  await expect(drawnName(renamed, 'pn-label')).toHaveText('Ledger');
  await expect(renamed).toBeFocused();

  await runFromMenu(page, 'Undo');

  await expect(nodeNamed(page, /^Store, store/u)).toHaveCount(1);
});

test('a store is renamed from the keyboard, on the selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectByKeyboard(page, /^Store, store/u);

  await page.keyboard.press('Enter');
  await rename(page, 'Store').fill('Ledger');
  await rename(page, 'Store').press('Enter');

  await expect(nodeNamed(page, /^Ledger, store/u)).toHaveCount(1);
});

test('escape leaves the name the model holds', async ({ page }) => {
  await openPlaceholder(page);
  const reader = await selectNode(page, /^Actor, actor/u);

  await page.keyboard.press(registeredChords.rename[0]);
  await rename(page, 'Actor').fill('Auditor');
  await rename(page, 'Actor').press('Escape');

  await expect(rename(page, 'Actor')).toHaveCount(0);
  await expect(nodeNamed(page, /^Actor, actor/u)).toHaveCount(1);
  await expect(reader).toBeFocused();
});

test('the menu opens the name of the selection in a field', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectNode(page, /^Store, store/u);

  await runFromMenu(page, 'Rename selection');

  await expect(rename(page, 'Store')).toBeFocused();
  await rename(page, 'Store').fill('Ledger');
  await rename(page, 'Store').press('Enter');

  await expect(nodeNamed(page, /^Ledger, store/u)).toHaveCount(1);
});

test('leaving the field for another control keeps the click that took focus', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectNode(page, /^Store, store/u);

  await page.keyboard.press(registeredChords.rename[0]);
  await rename(page, 'Store').fill('Ledger');
  await menuButton(page).click();

  await expect(nodeNamed(page, /^Ledger, store/u)).toHaveCount(1);
  await expect(page.getByRole('menu')).toBeVisible();
});

test('the field stands where the name was drawn and holds the whole of it', async ({
  page,
}) => {
  await openPlaceholder(page);
  const longName = 'Ledger of every transaction the studio records';
  await nodeNamed(page, /^Store, store/u).dblclick();
  await rename(page, 'Store').fill(longName);
  await rename(page, 'Store').press('Enter');
  const renamed = nodeNamed(page, new RegExp(`^${longName}, store`, 'u'));
  await expect(renamed).toBeFocused();

  await renamed.dblclick();

  const field = rename(page, longName);
  await expect(field).toBeFocused();
  await expect(drawnName(renamed, 'pn-label')).toHaveCount(0);
  await expect
    .poll(() =>
      field.evaluate((element) => ({
        wrapped:
          element.clientHeight >=
          2 * parseFloat(getComputedStyle(element).lineHeight),
        clipped: element.scrollHeight > element.clientHeight,
      })),
    )
    .toEqual({ wrapped: true, clipped: false });

  await field.press('Escape');

  await expect(drawnName(renamed, 'pn-label')).toContainText('Ledger');
});

test('a flow is renamed by double-clicking the label it draws', async ({
  page,
}) => {
  await openPlaceholder(page);
  await drawFlow(page);

  const flow = nodeNamed(page, /^New flow, flow/u);
  await drawnName(flow, 'pn-flow-label').dblclick();
  await expect(rename(page, 'New flow')).toBeFocused();
  await expect(drawnName(flow, 'pn-flow-label')).toHaveCount(0);
  await rename(page, 'New flow').fill('Opens');
  await rename(page, 'New flow').press('Enter');

  const renamed = nodeNamed(page, /^Opens, flow/u);
  await expect(renamed).toHaveCount(1);
  await expect(drawnName(renamed, 'pn-flow-label')).toHaveText('Opens');
});

test('a flow of a real model is renamed from the keyboard', async ({
  page,
}) => {
  await openEcluse(page);
  await selectByKeyboard(page, /^poll jobs, flow/u);

  await page.keyboard.press('Enter');
  await rename(page, 'poll jobs').fill('Polling');
  await rename(page, 'poll jobs').press('Enter');

  const renamed = nodeNamed(page, /^Polling, flow/u);
  await expect(renamed).toHaveCount(1);
  await expect(drawnName(renamed, 'pn-flow-label')).toHaveText('Polling');

  await runFromMenu(page, 'Undo');

  await expect(nodeNamed(page, /^poll jobs, flow/u)).toHaveCount(1);
});

test('Enter reopens a selected Note for prose editing', async ({ page }) => {
  await openPlaceholder(page);
  await canvasSurface(page).focus();
  await page.keyboard.press(registeredChords['note-tool'][0]);
  await page.keyboard.press('Enter');

  const editor = page.getByRole('textbox', { name: 'Note text' });
  await editor.fill('Review the trust boundary.');
  await editor.press('ControlOrMeta+Enter');
  await expect(nodeNamed(page, /^Note, text/u)).toBeFocused();

  await page.keyboard.press('Enter');

  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('Review the trust boundary.');
});

test('T focuses threats and Enter adds one', async ({ page }) => {
  await openPlaceholder(page);
  await selectByKeyboard(page, /^Actor, actor/u);

  await page.keyboard.press(registeredChords['focus-threats'][0]);
  const add = page.getByRole('button', { name: 'Add a threat' });
  await expect(add).toBeFocused();

  await page.keyboard.press('Enter');

  await expect(page.getByRole('textbox', { name: 'Title' })).toBeFocused();
});
