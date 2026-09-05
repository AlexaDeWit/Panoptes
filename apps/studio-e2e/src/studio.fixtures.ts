import { expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const developmentModelKey = 'panoptesDevelopmentModel';

const ecluse: unknown = JSON.parse(
  readFileSync(join(__dirname, '../../../test-data/ecluse.model.json'), 'utf8'),
);

/**
 * Opens the studio on Écluse's model, put on the page before the studio's own
 * modules run under the name `apps/studio/src/store/development-model.ts`
 * declares, which is how a real file reaches the canvas while the open dialog
 * is still issue #37's. `globalThis` in a page is the window the studio reads.
 */
export const openEcluse = async (page: Page): Promise<void> => {
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
export const openPlaceholder = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();
};

/**
 * Every element drawn as a box. The anchor a free flow end rides on is hidden
 * from assistive technology, so it is no group and is not among these.
 */
export const elementNodes = (page: Page): Locator =>
  page.locator('.react-flow__nodes').getByRole('group');

/** One element or flow, by the name assistive technology has for it. */
export const nodeNamed = (page: Page, name: string | RegExp): Locator =>
  page.getByRole('group', { name });

/**
 * The canvas itself, which React Flow gives the application role and the
 * canvas its name. It is where focus lands once the element that held it has
 * been deleted.
 */
export const canvasSurface = (page: Page): Locator =>
  page.getByRole('application', { name: 'Diagram' });

/** What the canvas last said an edit did. */
export const editAnnouncement = (page: Page): Locator =>
  page.getByTestId('canvas-announcement');

/**
 * The last control on the tab path before the canvas while nothing is
 * selected, which is where a spec that tabs into the diagram starts. The
 * palette's own controls sit between the studio's buttons and the canvas, and
 * its two connecting controls are disabled, and so no tab stop, until an
 * element is selected. Once one is, {@link connectTarget} is the last stop.
 */
export const beforeCanvas = (page: Page): Locator =>
  page.getByRole('button', { name: 'New trust boundary curve' });

/** The listbox a flow's other end is chosen from. */
export const connectTarget = (page: Page): Locator =>
  page.getByRole('combobox', { name: 'Flow to' });

/**
 * Where React Flow has placed a node, read off the transform in its style
 * attribute. The rest of the attribute is left out: selecting a node also
 * raises it, and a spec about position should not read that.
 */
export const placeOf = async (node: Locator): Promise<string> => {
  const style = (await node.getAttribute('style')) ?? '';
  return /translate\([^)]*\)/u.exec(style)?.[0] ?? style;
};

/** How wide React Flow is drawing a node, read off the same attribute. */
export const widthOf = async (node: Locator): Promise<string> => {
  const style = (await node.getAttribute('style')) ?? '';
  return /width:\s*[^;]*/u.exec(style)?.[0] ?? style;
};

/** Drags whatever is at the centre of `target` by `by` pixels each way. */
export const dragBy = async (
  page: Page,
  target: Locator,
  by: number,
): Promise<void> => {
  const box = await target.boundingBox();
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

/** Drags from the centre of one locator to the centre of another. */
export const dragOnto = async (
  page: Page,
  from: Locator,
  onto: Locator,
): Promise<void> => {
  const start = await from.boundingBox();
  const end = await onto.boundingBox();
  expect(start).not.toBeNull();
  expect(end).not.toBeNull();
  await page.mouse.move(
    (start?.x ?? 0) + (start?.width ?? 0) / 2,
    (start?.y ?? 0) + (start?.height ?? 0) / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    (end?.x ?? 0) + (end?.width ?? 0) / 2,
    (end?.y ?? 0) + (end?.height ?? 0) / 2,
    { steps: 12 },
  );
  await page.mouse.up();
};

/**
 * Selects an element by clicking it, retried until the canvas reports it
 * selected. React Flow measures the nodes and fits the view after the first
 * paint, so a click sent while the page is still settling lands where the
 * node is about to be rather than where it is, which takes the selection off
 * instead of putting it on.
 */
export const selectNode = async (
  page: Page,
  name: RegExp,
): Promise<Locator> => {
  const node = nodeNamed(page, name);
  await expect(async () => {
    await node.click();
    await expect(node).toHaveClass(/selected/u, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  return node;
};

/**
 * The option the open listbox has focused, waited for. Radix marks it with
 * `aria-selected` only while it is both focused and the value already set, so
 * focus is what a spec follows through a listbox rather than that attribute.
 */
export const focusedOption = (page: Page): Locator =>
  page.locator('[role="option"]:focus');

/**
 * Chooses the option one step from the one already set, from the focused
 * listbox trigger, by keyboard alone. Radix focuses the chosen item as the
 * listbox opens and again once the popper has been positioned, so an arrow
 * key pressed between the two moves nothing: the press is repeated until the
 * highlight lands somewhere else.
 */
export const chooseByKeyboard = async (
  page: Page,
  step: 'ArrowDown' | 'ArrowUp',
): Promise<void> => {
  await page.keyboard.press('Enter');
  await expect(focusedOption(page)).toHaveCount(1);
  const already = (await focusedOption(page).textContent()) ?? '';
  await expect(async () => {
    await page.keyboard.press(step);
    await expect(focusedOption(page)).not.toHaveText(already, {
      timeout: 250,
    });
  }).toPass();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toHaveCount(0);
};
