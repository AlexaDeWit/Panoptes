import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The studio opens on a development model when the page carries one, which is
// how a real file reaches the canvas while the open dialog is still issue
// #37's. The name is the one apps/studio/src/store/development-model.ts reads,
// set on globalThis, which in a page is the window the studio reads it off.
const developmentModelKey = 'panoptesDevelopmentModel';

const ecluse: unknown = JSON.parse(
  readFileSync(join(__dirname, '../../../test-data/ecluse.model.json'), 'utf8'),
);

const openEcluse = async (page: Page): Promise<void> => {
  await page.addInitScript(
    ({ key, model }) => {
      Object.defineProperty(globalThis, key, { value: model });
    },
    { key: developmentModelKey, model: ecluse },
  );
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();
};

const openPlaceholder = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();
};

const elementNodes = (page: Page): Locator =>
  page.locator('.react-flow__nodes').getByRole('group');

const nodeNamed = (page: Page, name: string | RegExp): Locator =>
  page.getByRole('group', { name });

// React Flow places a node with a transform in its style attribute, so that
// is where a move shows up. The rest of the attribute is left out: selecting
// a node also raises it, and a spec about position should not read that.
const placeOf = async (node: Locator): Promise<string> => {
  const style = (await node.getAttribute('style')) ?? '';
  return /translate\([^)]*\)/u.exec(style)?.[0] ?? style;
};

const dragBy = async (page: Page, node: Locator, by: number): Promise<void> => {
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  const from = {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + by, from.y + by, { steps: 8 });
  await page.mouse.up();
};

test('the whole of a real model is drawn, elements and flows alike', async ({
  page,
}) => {
  await openEcluse(page);

  // Écluse's one diagram: 18 elements the canvas draws as boxes and 20 flows.
  // The anchor a free flow end rides on is hidden from assistive technology,
  // so it is no group and does not count here.
  await expect(elementNodes(page)).toHaveCount(18);
  await expect(page.locator('.react-flow__edge')).toHaveCount(20);
  await expect(nodeNamed(page, /^Écluse proxy, process/u)).toBeVisible();
});

test('a click selects an element and the canvas draws the selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  const reader = nodeNamed(page, /^Reader, actor/u);

  await reader.click();

  await expect(reader).toHaveClass(/selected/u);
  await expect(nodeNamed(page, /^Studio, process/u)).not.toHaveClass(
    /selected/u,
  );
});

test('a drag moves the element through the store, and undo puts it back', async ({
  page,
}) => {
  await openPlaceholder(page);
  const reader = nodeNamed(page, /^Reader, actor/u);
  const before = await placeOf(reader);

  await dragBy(page, reader, 60);

  await expect.poll(() => placeOf(reader)).not.toBe(before);

  await page.getByRole('button', { name: 'Undo' }).click();

  await expect.poll(() => placeOf(reader)).toBe(before);
});

test('an element is reachable, selectable and movable by keyboard alone', async ({
  page,
}) => {
  await openPlaceholder(page);
  const reader = nodeNamed(page, /^Reader, actor/u);

  // The Undo button beside it is disabled while there is nothing to undo, so
  // the tab after the last control on the page reaches the first element.
  await page.getByRole('button', { name: 'Add a process' }).focus();
  await page.keyboard.press('Tab');
  await expect(reader).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(nodeNamed(page, /^Studio, process/u)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(reader).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(reader).toHaveClass(/selected/u);

  const selected = await placeOf(reader);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => placeOf(reader)).not.toBe(selected);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => placeOf(reader)).toBe(selected);
});

test('a threat edited off the canvas moves the badge on the element it names', async ({
  page,
}) => {
  await openPlaceholder(page);

  await expect(
    nodeNamed(page, 'Reader, actor, 1 open threat, highest severity medium'),
  ).toBeVisible();

  await page.getByRole('combobox', { name: 'Severity' }).click();
  await page.getByRole('option', { name: 'critical' }).click();

  await expect(
    nodeNamed(page, 'Reader, actor, 1 open threat, highest severity critical'),
  ).toBeVisible();
  await expect(page.locator('.pn-badge-mark')).toHaveText('C');
});
