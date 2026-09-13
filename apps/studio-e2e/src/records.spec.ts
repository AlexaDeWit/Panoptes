import { expect, test, type Locator, type Page } from '@playwright/test';
import { registeredChords } from './chords.js';
import {
  centreOf,
  closeMenu,
  menuItem,
  nodeNamed,
  openEcluse,
  openMenu,
  runFromMenu,
  selectNode,
  threatPanel,
} from './studio.fixtures.js';

const proxy = /^Écluse proxy, process/u;

const dredger = /^Écluse Dredger, process/u;

const purge = /Dredger inappropriately purges/u;

const forwarded = /Forwarded caller credentials/u;

const chokepoint = /Chokepoint exhaustion/u;

const expandThreat = async (page: Page, title: RegExp): Promise<void> => {
  const disclosure = threatPanel(page).getByRole('button', { name: title });
  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
};

const field = (page: Page, role: 'textbox' | 'combobox', name: string) =>
  threatPanel(page).getByRole(role, { name, exact: true });

const control = (page: Page, name: string): Locator =>
  threatPanel(page).getByRole('button', { name, exact: true });

const choose = async (
  page: Page,
  name: string,
  option: string,
): Promise<void> => {
  await field(page, 'combobox', name).click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
};

const onScreen = async (target: Locator): Promise<void> => {
  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeInViewport();
  const at = await centreOf(target);
  const reached = await target.evaluate(
    (node, point) => node.contains(document.elementFromPoint(point.x, point.y)),
    at,
  );
  expect(reached, 'a record control is covered').toBe(true);
};

const undoOffered = async (page: Page): Promise<boolean> => {
  await openMenu(page);
  const disabled = await menuItem(page, 'Undo').getAttribute('aria-disabled');
  await closeMenu(page);
  return disabled !== 'true';
};

test('a mitigation added from the empty row is one undo step, and its status changes in place', async ({
  page,
}) => {
  await openEcluse(page);
  await selectNode(page, dredger);
  await expandThreat(page, purge);
  const threatStatus = field(page, 'combobox', 'Status');
  const before = await threatStatus.textContent();

  const add = control(page, 'Add mitigation');
  await onScreen(add);
  await add.click();

  const title = field(page, 'textbox', 'Mitigation 1 title');
  await expect(title).toBeFocused();
  await onScreen(title);
  await page.keyboard.type('Keep a restorable copy of every purge');
  await page.keyboard.press('Tab');
  await expect(
    field(page, 'textbox', 'Mitigation 1 description'),
  ).toBeFocused();

  const status = field(page, 'combobox', 'Mitigation 1 status');
  await onScreen(status);
  await expect(status).toContainText(/proposed/iu);
  await onScreen(control(page, 'Unlink mitigation 1'));

  for (const chosen of ['implemented', 'verified']) {
    await choose(page, 'Mitigation 1 status', chosen);
    await expect(status).toContainText(chosen);
    await expect(threatStatus).toHaveText(before ?? '');
  }

  await runFromMenu(page, 'Undo');
  await expect(status).toContainText(/implemented/iu);
  await runFromMenu(page, 'Undo');
  await runFromMenu(page, 'Undo');
  await expect(title).toHaveCount(0);
  await runFromMenu(page, 'Redo');
  await expect(title).toHaveValue('Keep a restorable copy of every purge');
});

test('Tab out of a new record reaches its status, and undoing the record keeps focus in its group', async ({
  page,
}) => {
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);

  await control(page, 'Add assumption').click();
  await page.keyboard.type('Callers rotate their tokens.');
  await page.keyboard.press('Tab');

  const status = field(page, 'combobox', 'Assumption 1 status');
  await expect(status).toBeFocused();

  await page.keyboard.press(registeredChords.undo[0]);

  await expect(status).toHaveCount(0);
  await expect(control(page, 'Add assumption')).toBeFocused();
});

test('a click on Add right after typing in a new row keeps the record and opens the next row', async ({
  page,
}) => {
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);

  const add = control(page, 'Add mitigation');
  await add.click();
  await page.keyboard.type('Strip caller tokens at the edge');
  await add.click();

  await expect(field(page, 'textbox', 'Mitigation 1 title')).toHaveValue(
    'Strip caller tokens at the edge',
  );
  await expect(field(page, 'textbox', 'Mitigation 2 title')).toBeFocused();
});

test('Shift+Tab from Existing reaches Add after a new row became a record', async ({
  page,
}) => {
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);
  await control(page, 'Add mitigation').click();
  await page.keyboard.type('Bound every upstream response');
  await page.keyboard.press('Tab');

  await expandThreat(page, chokepoint);
  await control(page, 'Add mitigation').click();
  await page.keyboard.type('Shed load at the chokepoint');
  const existing = field(page, 'combobox', 'Existing mitigation');
  await existing.focus();
  await expect(field(page, 'textbox', 'Mitigation 1 title')).toHaveValue(
    'Shed load at the chokepoint',
  );
  await page.keyboard.press('Shift+Tab');

  await expect(control(page, 'Add mitigation')).toBeFocused();
});

test('Discard on a new row with typed text leaves no record and nothing to undo', async ({
  page,
  isMobile,
}) => {
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);

  const add = control(page, 'Add mitigation');
  await add.click();
  await page.keyboard.type('Strip caller tokens at the edge');
  const discard = control(page, 'Discard mitigation 1');
  await (isMobile ? discard.tap() : discard.click());

  await expect(field(page, 'textbox', 'Mitigation 1 title')).toHaveCount(0);
  await expect(add).toBeFocused();
  expect(await undoOffered(page)).toBe(false);
});

test('leaving the empty row leaves no record and nothing to undo', async ({
  page,
}) => {
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);

  const add = control(page, 'Add assumption');
  await add.click();
  const prose = field(page, 'textbox', 'Assumption 1');
  await expect(prose).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(field(page, 'combobox', 'Assumption 1 status')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(control(page, 'Discard assumption 1')).toBeFocused();
  await page.keyboard.press('Tab');

  await expect(add).toBeFocused();
  await expect(prose).toHaveCount(0);
  expect(await undoOffered(page)).toBe(false);
});

test('a linked record says how many other threats hold it, and unlinking culls it only from its last threat', async ({
  page,
}) => {
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);

  await control(page, 'Add mitigation').click();
  await page.keyboard.type('Bound every upstream response');
  await page.keyboard.press('Tab');
  await expect(field(page, 'combobox', 'Existing mitigation')).toHaveCount(0);

  await expandThreat(page, chokepoint);
  await expect(field(page, 'combobox', 'Existing mitigation')).toContainText(
    'Bound every upstream response',
  );
  await control(page, 'Link existing mitigation').click();

  const linked = field(page, 'textbox', 'Mitigation 1 title');
  await expect(linked).toHaveValue('Bound every upstream response');
  await expect(linked).toBeFocused();
  await expect(field(page, 'combobox', 'Existing mitigation')).toHaveCount(0);
  await expect(
    control(page, 'Unlink mitigation 1'),
  ).toHaveAccessibleDescription(/1/u);

  await control(page, 'Unlink mitigation 1').click();
  await expect(linked).toHaveCount(0);
  await expect(field(page, 'combobox', 'Existing mitigation')).toContainText(
    'Bound every upstream response',
  );

  await expandThreat(page, forwarded);
  const kept = field(page, 'textbox', 'Mitigation 1 title');
  await expect(kept).toHaveValue('Bound every upstream response');
  await expect(
    control(page, 'Unlink mitigation 1'),
  ).not.toHaveAccessibleDescription(/1/u);

  await control(page, 'Unlink mitigation 1').click();
  await expect(kept).toHaveCount(0);
  await expect(field(page, 'combobox', 'Existing mitigation')).toHaveCount(0);

  await runFromMenu(page, 'Undo');
  await expect(kept).toHaveValue('Bound every upstream response');
});

test('a record edit in one tab reaches another, which keeps its own selection', async ({
  context,
  page,
}) => {
  const other = await context.newPage();
  await openEcluse(page);
  await openEcluse(other);
  const worker = await selectNode(other, /^Mirror worker, process/u);

  await selectNode(page, proxy);
  await expandThreat(page, forwarded);
  await control(page, 'Add mitigation').click();
  await page.keyboard.type('Strip caller tokens at the edge');
  await page.keyboard.press('Tab');
  await expect(field(page, 'combobox', 'Mitigation 1 status')).toBeVisible();

  await expect.poll(() => undoOffered(other)).toBe(true);
  await expect(worker).toHaveClass(/selected/u);
  await expect(
    threatPanel(other).getByRole('heading', { name: /Mirror worker/u }),
  ).toBeVisible();

  await selectNode(other, proxy);
  await expandThreat(other, forwarded);
  await expect(field(other, 'textbox', 'Mitigation 1 title')).toHaveValue(
    'Strip caller tokens at the edge',
  );
  await choose(other, 'Mitigation 1 status', 'verified');

  await expect(field(page, 'combobox', 'Mitigation 1 status')).toContainText(
    /verified/iu,
  );
  await expect(nodeNamed(page, proxy)).toHaveClass(/selected/u);
});
