import { expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const developmentModelKey = 'panoptesDevelopmentModel';

/** A file of the repository, named from the root, as a path on disk. */
export const vendored = (path: string): string =>
  join(__dirname, '../../..', path);

const ecluse: unknown = JSON.parse(
  readFileSync(vendored('test-data/ecluse.model.json'), 'utf8'),
);

/**
 * Waits for the canvas to stop moving. React Flow measures the nodes it has
 * drawn and fits the view to them a frame later, so a click sent before that
 * lands where a node is about to be rather than where it is. The viewport's
 * own transform is the signal, and it is read twice: it has settled when a
 * poll finds it where the poll before found it.
 */
export const canvasSettled = async (page: Page): Promise<void> => {
  const viewport = page.locator('.react-flow__viewport');
  let before = '';
  await expect
    .poll(async () => {
      const now = (await viewport.getAttribute('style')) ?? '';
      const settled = now !== '' && now === before;
      before = now;
      return settled;
    })
    .toBe(true);
};

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
  await canvasSettled(page);
};

/** Opens the studio on the model it carries until a file can be opened. */
export const openPlaceholder = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();
  await canvasSettled(page);
};

/**
 * Takes the File System Access API off the page, so the studio falls back to
 * its own file input and to a download. Playwright cannot operate the native
 * pickers that API opens, and the fallback is the path a browser without it
 * takes anyway.
 */
export const withoutPickers = (): void => {
  Reflect.deleteProperty(globalThis, 'showOpenFilePicker');
  Reflect.deleteProperty(globalThis, 'showSaveFilePicker');
};

/**
 * Opens a file of the repository through the fallback picker, and holds that
 * it was read and drawn. The format is the file's own: the studio reads the
 * content rather than the name.
 */
export const openFile = async (page: Page, path: string): Promise<void> => {
  await page.addInitScript(withoutPickers);
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();
  await page.getByTestId('file-input').setInputFiles(vendored(path));
  await expect(page.getByTestId('failure-notice')).toBeEmpty();
  await canvasSettled(page);
};

/** A file the studio wrote through the download path. */
export type SavedFile = {
  readonly name: string;
  readonly text: string;
};

/** Saves through that download path, and reads back what was written. */
export const savedFile = async (page: Page): Promise<SavedFile> => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save', exact: true }).click(),
  ]);
  return {
    name: download.suggestedFilename(),
    text: readFileSync(await download.path(), 'utf8'),
  };
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

/** The panel holding the threats of whatever the canvas has selected. */
export const threatPanel = (page: Page): Locator =>
  page.getByRole('region', { name: 'Threats' });

/** Chooses an option in one of the panel's listboxes, by pointer. */
export const chooseInPanel = async (
  page: Page,
  field: string,
  option: string,
): Promise<void> => {
  await threatPanel(page).getByRole('combobox', { name: field }).click();
  await page.getByRole('option', { name: option }).click();
};

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
 * Selects an element by clicking it, and holds that the click landed. The
 * element is on the page and the canvas has stopped moving before the click
 * is sent ({@link canvasSettled}), so one click is one selection: a click
 * that does not select is a regression in the canvas rather than something
 * to send again.
 */
export const selectNode = async (
  page: Page,
  name: RegExp,
): Promise<Locator> => {
  const node = nodeNamed(page, name);
  await expect(node).toBeVisible();
  await canvasSettled(page);
  await node.click();
  await expect(node).toHaveClass(/selected/u);
  return node;
};

/**
 * Selects an element by focusing it and pressing Enter, and waits for the
 * canvas to pan to it. Opening a file leaves the viewport where the model
 * before it put it, so an element of a real diagram can be drawn outside the
 * view, where the pointer cannot reach it and this path can.
 */
export const selectByKeyboard = async (
  page: Page,
  name: RegExp,
): Promise<Locator> => {
  const node = nodeNamed(page, name);
  await expect(node).toBeVisible();
  await canvasSettled(page);
  await node.focus();
  await page.keyboard.press('Enter');
  await expect(node).toHaveClass(/selected/u);
  await canvasSettled(page);
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
