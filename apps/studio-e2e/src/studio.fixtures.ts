import { expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Box, Point } from './canvas-geometry.fixtures.js';

const developmentModelKey = 'saerskrivenDevelopmentModel';

/** A file of the repository, named from the root, as a path on disk. */
export const vendored = (path: string): string =>
  join(__dirname, '../../..', path);

/** The box the diagram is drawn in, chrome and graph paper included. */
export const canvasContainer = (page: Page): Locator =>
  page.getByTestId('canvas-container');

/**
 * Waits for the canvas to stop moving. `FitOnOpen` fits the view to the
 * diagram from an effect, once React Flow has measured the canvas, so a click
 * sent before that lands where a node is about to be rather than where it
 * is. The viewport's
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

export const focusSettled = async (target: Locator): Promise<void> => {
  let before = false;
  await expect
    .poll(async () => {
      const now = await target.evaluate(
        (element) => element === document.activeElement,
      );
      const settled = now && before;
      before = now;
      return settled;
    })
    .toBe(true);
};

/**
 * Opens the studio on a model document of the repository, put on the page
 * before the studio's own modules run under the name
 * `apps/studio/src/store/development-model.ts` declares, which is how a real
 * file reaches the canvas without a picker. `globalThis` in a page is the
 * window the studio reads. A recovery snapshot still wins over the document,
 * so a reload lands on the session rather than back on the file.
 */
export const openModel = async (page: Page, path: string): Promise<void> => {
  const model: unknown = JSON.parse(readFileSync(vendored(path), 'utf8'));
  await page.addInitScript(
    ({ key, model: document }) => {
      Object.defineProperty(globalThis, key, { value: document });
    },
    { key: developmentModelKey, model },
  );
  await page.goto('/');
  await expect(canvasContainer(page)).toBeVisible();
  await canvasSettled(page);
};

/** Opens the studio on Écluse's model, through {@link openModel}. */
export const openEcluse = async (page: Page): Promise<void> => {
  await openModel(page, 'test-data/ecluse.model.json');
};

/** The two-diagram model of Saerskriven's own threat model. */
export const saerskrivenModel = 'test-data/saerskriven.model.json';

/**
 * The control naming the diagram on screen, in the page only while the model
 * holds more than one diagram.
 */
export const diagramSwitcher = (page: Page): Locator =>
  page.getByTestId('diagram-switcher');

/** One diagram in the open menu or the open switcher, by its title. */
export const diagramChoice = (page: Page, title: string): Locator =>
  page.getByRole('menuitemradio', { name: title, exact: true });

/** Opens the studio on the model it carries until a file can be opened. */
export const openPlaceholder = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(canvasContainer(page)).toBeVisible();
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
export const openFile = async (
  page: Page,
  path: string,
  entry = '/',
): Promise<void> => {
  await page.addInitScript(withoutPickers);
  await page.goto(entry);
  await expect(canvasContainer(page)).toBeVisible();
  await page.getByTestId('file-input').setInputFiles(vendored(path));
  await expect(page.getByTestId('failure-notice')).toBeEmpty();
  await canvasSettled(page);
};

/** The button the studio's one menu opens from. */
export const menuButton = (page: Page): Locator =>
  page.getByRole('button', { name: /^Menu/u });

/** One command of the open menu, by the words it runs under. */
export const menuItem = (page: Page, name: string): Locator =>
  page.getByRole('menuitem', { name, exact: true });

/**
 * Opens the menu, and does nothing where it is already open. What the menu
 * says about the file is only in the page while it is open, so a spec that
 * reads that opens the menu first.
 */
export const openMenu = async (page: Page): Promise<void> => {
  if (await page.getByRole('menu').isVisible()) {
    return;
  }
  await menuButton(page).click();
  await expect(page.getByRole('menu')).toBeVisible();
};

/** Puts the menu away, and does nothing where it is already away. */
export const closeMenu = async (page: Page): Promise<void> => {
  if ((await page.getByRole('menu').count()) === 0) {
    return;
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
};

/** Runs one menu command, which puts the menu away as it runs. */
export const runFromMenu = async (page: Page, name: string): Promise<void> => {
  await openMenu(page);
  await menuItem(page, name).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
};

/** A file the studio wrote through the download path. */
export type SavedFile = {
  readonly name: string;
  readonly text: string;
};

/** Saves through that download path, and reads back what was written. */
export const savedFile = async (page: Page): Promise<SavedFile> => {
  await openMenu(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    menuItem(page, 'Save').click(),
  ]);
  return {
    name: download.suggestedFilename(),
    text: readFileSync(await download.path(), 'utf8'),
  };
};

/** An export downloaded from the menu, as its name and bytes. */
export type ExportedFile = {
  readonly name: string;
  readonly bytes: Buffer;
};

/** Opens the Export menu, chooses one item and reads its download. */
export const exportedFile = async (
  page: Page,
  item: string,
): Promise<ExportedFile> => {
  await openMenu(page);
  await menuItem(page, 'Export').hover();
  const chosen = menuItem(page, item);
  await expect(chosen).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    chosen.click(),
  ]);
  return {
    name: download.suggestedFilename(),
    bytes: readFileSync(await download.path()),
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
 * One of the four handles a flow attaches to, by the side of the element it
 * sits at. React Flow names a handle by the id the canvas gave it, which is
 * that side.
 */
export const handleOn = (
  node: Locator,
  side: 'top' | 'right' | 'bottom' | 'left',
): Locator => node.locator(`[data-handleid="${side}"]`);

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

/** One icon in the floating toolbox. */
export const toolButton = (page: Page, name: string): Locator =>
  page.getByRole('button', { name, exact: true });

/**
 * The last control on the tab path before the canvas, which is where a spec
 * that tabs into the diagram starts. The menu's button is that stop whether or
 * not anything is selected, the only control after it being the one that
 * dismisses a loss report, which is in the page only while a crossing of the
 * file boundary has cost something. A model of more than one diagram puts
 * the diagram switcher after the button too, so a spec on such a model
 * starts from the switcher rather than from here.
 */
export const beforeCanvas = (page: Page): Locator => menuButton(page);

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

export const centreOf = async (target: Locator): Promise<Point> => {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  return {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  };
};

/** Drags from the centre of `target` by the given screen-pixel offset. */
export const dragBy = async (
  page: Page,
  target: Locator,
  by: number | Point,
): Promise<void> => {
  const start = await centreOf(target);
  const offset = typeof by === 'number' ? { x: by, y: by } : by;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + offset.x, start.y + offset.y, { steps: 8 });
  await page.mouse.up();
};

/** Drags from the centre of a locator to a point on the page. */
export const dragTo = async (
  page: Page,
  from: Locator,
  to: Point,
): Promise<void> => {
  const start = await centreOf(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
};

/** Drags from the centre of one locator to the centre of another. */
export const dragOnto = async (
  page: Page,
  from: Locator,
  onto: Locator,
): Promise<void> => {
  await dragTo(page, from, await centreOf(onto));
};

/** Draws one selection box around every node in `targets`. */
export const boxSelect = async (
  page: Page,
  targets: readonly [Locator, ...Locator[]],
): Promise<void> => {
  const boxes = await Promise.all(
    targets.map((target) => target.boundingBox()),
  );
  expect(boxes.every((box) => box !== null)).toBe(true);
  const drawn = boxes.filter((box): box is Box => box !== null);
  const margin = 16;
  const from = {
    x: Math.min(...drawn.map((box) => box.x)) - margin,
    y: Math.min(...drawn.map((box) => box.y)) - margin,
  };
  const to = {
    x: Math.max(...drawn.map((box) => box.x + box.width)) + margin,
    y: Math.max(...drawn.map((box) => box.y + box.height)) + margin,
  };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await expect(page.locator('.react-flow__selection')).toBeVisible();
  await page.mouse.up();
};

const clearBy = 48;

const steps = 8;

const chromeFree = 0.75;

const grid = Array.from({ length: steps - 1 }, (unused, step) => step + 1);

const clearOf = (boxes: readonly (Box | null)[], at: Point): boolean =>
  boxes.every(
    (box) =>
      box === null ||
      at.x < box.x - clearBy ||
      at.x > box.x + box.width + clearBy ||
      at.y < box.y - clearBy ||
      at.y > box.y + box.height + clearBy,
  );

/**
 * A point on the canvas that no element is drawn near, which is where a
 * connection released cancels. It is searched for rather than assumed: a fit
 * puts the diagram wherever the model it opened needs, so which part of the
 * canvas is clear moves with the file. The margin is well past React Flow's
 * connection radius, so a drop there resolves to no handle rather than
 * snapping to the nearest one. The bottom quarter is left out, being where
 * the floating chrome sits.
 */
export const emptyCanvasPoint = async (page: Page): Promise<Point> => {
  const canvas = await canvasContainer(page).boundingBox();
  expect(canvas).not.toBeNull();
  const corner = { x: canvas?.x ?? 0, y: canvas?.y ?? 0 };
  const room = {
    width: canvas?.width ?? 0,
    height: (canvas?.height ?? 0) * chromeFree,
  };
  const drawn = await Promise.all(
    (await elementNodes(page).all()).map(async (node) => node.boundingBox()),
  );
  const candidates = grid
    .flatMap((column) =>
      grid.map((row) => ({
        x: corner.x + (room.width * column) / steps,
        y: corner.y + (room.height * row) / steps,
      })),
    )
    .filter((at) => clearOf(drawn, at));
  const clear = await page.evaluate(
    (points) =>
      points.find(
        (at) =>
          document
            .elementFromPoint(at.x, at.y)
            ?.closest('.react-flow__pane') instanceof Element,
      ),
    candidates,
  );

  expect(clear, 'the canvas has no point clear of every element').toBeDefined();
  return clear ?? corner;
};

/**
 * Selects an element tool and clicks a clear point on the canvas. The placed
 * element is returned with its placeholder name open in the in-place field.
 */
export const placeByClick = async (
  page: Page,
  tool: 'Actor' | 'Process' | 'Store' | 'Trust boundary',
  named: RegExp,
): Promise<Locator> => {
  const at = await emptyCanvasPoint(page);
  await toolButton(page, tool).click();
  await page.mouse.click(at.x, at.y);
  const placed = nodeNamed(page, named);
  await expect(placed).toHaveCount(1);
  return placed;
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
 * Selects an element by focusing it and pressing Enter, then waits for the
 * canvas to stop moving: React Flow pans a node focused from the keyboard
 * into view where it is not already drawn there.
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
 * Moves the highlight one step through the open listbox and answers where it
 * landed. Radix focuses the chosen item as the listbox opens and again once
 * the popper has been positioned, so an arrow key pressed between the two
 * moves nothing: the press is repeated until the highlight lands somewhere
 * else.
 */
export const stepThroughOptions = async (
  page: Page,
  step: 'ArrowDown' | 'ArrowUp',
): Promise<string> => {
  await expect(focusedOption(page)).toHaveCount(1);
  const already = (await focusedOption(page).textContent()) ?? '';
  await expect(async () => {
    await page.keyboard.press(step);
    await expect(focusedOption(page)).not.toHaveText(already, {
      timeout: 250,
    });
  }).toPass();
  return (await focusedOption(page).textContent()) ?? '';
};

/**
 * Chooses the option one step from the one already set, from the focused
 * listbox trigger, by keyboard alone.
 */
export const chooseByKeyboard = async (
  page: Page,
  step: 'ArrowDown' | 'ArrowUp',
): Promise<void> => {
  await page.keyboard.press('Enter');
  await stepThroughOptions(page, step);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toHaveCount(0);
};
