import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The name the studio reads a development session's model off the page by,
 * as `apps/studio/src/store/development-model.ts` declares it. Setting it is
 * how a real file reaches the canvas while the open dialog is still issue
 * #37's.
 */
const developmentModelKey = 'panoptesDevelopmentModel';

const ecluse: unknown = JSON.parse(
  readFileSync(join(__dirname, '../../../test-data/ecluse.model.json'), 'utf8'),
);

/**
 * Opens the studio on Écluse's model, put on the page before the studio's own
 * modules run. `globalThis` in a page is the window the studio reads.
 */
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

/** Opens the studio on the model it carries until a file can be opened. */
const openPlaceholder = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();
};

/**
 * Every element drawn as a box. The anchor a free flow end rides on is hidden
 * from assistive technology, so it is no group and is not among these.
 */
const elementNodes = (page: Page): Locator =>
  page.locator('.react-flow__nodes').getByRole('group');

const nodeNamed = (page: Page, name: string | RegExp): Locator =>
  page.getByRole('group', { name });

/**
 * Where React Flow has placed a node, read off the transform in its style
 * attribute. The rest of the attribute is left out: selecting a node also
 * raises it, and a spec about position should not read that.
 */
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

test('a real model is drawn whole: 18 elements and 20 flows', async ({
  page,
}) => {
  await openEcluse(page);

  await expect(elementNodes(page)).toHaveCount(18);
  await expect(page.locator('.react-flow__edge')).toHaveCount(20);
  await expect(nodeNamed(page, /^Écluse proxy, process/u)).toBeVisible();
});

test('tabbing into a real model reaches every flow before any element', async ({
  page,
}) => {
  await openEcluse(page);

  await page.getByRole('button', { name: 'Add a process' }).focus();
  await page.keyboard.press('Tab');

  await expect(page.locator('.react-flow__edge:focus')).toHaveCount(1);
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

test('the selection moves between an element and a flow, either way', async ({
  page,
}) => {
  await openEcluse(page);
  const proxy = nodeNamed(page, /^Écluse proxy, process/u);
  const selectedFlow = page.locator('.react-flow__edge.selected');

  await proxy.click();
  await expect(proxy).toHaveClass(/selected/u);

  await page.getByRole('button', { name: 'Add a process' }).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(selectedFlow).toHaveCount(1);
  await expect(proxy).not.toHaveClass(/selected/u);

  await proxy.click();
  await expect(proxy).toHaveClass(/selected/u);
  await expect(selectedFlow).toHaveCount(0);
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

test('an element is reachable, selectable and movable by keyboard alone, the disabled Undo beside it being no tab stop', async ({
  page,
}) => {
  await openPlaceholder(page);
  const reader = nodeNamed(page, /^Reader, actor/u);

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
