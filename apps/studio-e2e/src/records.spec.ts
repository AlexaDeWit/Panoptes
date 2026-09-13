import { expect, test, type Locator, type Page } from '@playwright/test';
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
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);

  const add = control(page, 'Add mitigation');
  await onScreen(add);
  await add.click();

  const title = field(page, 'textbox', 'Mitigation 1 title');
  await expect(title).toBeFocused();
  await onScreen(title);
  await page.keyboard.type('Strip caller tokens at the edge');
  await page.keyboard.press('Tab');
  await expect(
    field(page, 'textbox', 'Mitigation 1 description'),
  ).toBeFocused();

  const status = field(page, 'combobox', 'Mitigation 1 status');
  await onScreen(status);
  await expect(status).toContainText(/proposed/iu);
  await onScreen(control(page, 'Unlink mitigation 1'));

  await choose(page, 'Mitigation 1 status', 'implemented');
  await expect(status).toContainText(/implemented/iu);
  await expect(field(page, 'combobox', 'Status')).toContainText(/mitigated/iu);

  await runFromMenu(page, 'Undo');
  await expect(status).toContainText(/proposed/iu);
  await runFromMenu(page, 'Undo');
  await expect(title).toHaveCount(0);
  await runFromMenu(page, 'Redo');
  await expect(title).toHaveValue('Strip caller tokens at the edge');
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
