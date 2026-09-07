import { expect, test, type Locator, type Page } from '@playwright/test';
import { halfwayAlong, lineOf } from './canvas-geometry.fixtures.js';
import { registeredChords } from './chords.js';
import { nodeNamed, openPlaceholder, selectNode } from './studio.fixtures.js';

const actor = /^Actor, actor/u;

const drawnFlow = /^New flow, flow, from Actor to Store/u;

const canvas = (page: Page): Locator => page.getByTestId('canvas-container');

const pane = (page: Page): Locator => page.locator('.react-flow__pane');

const handlesOn = (node: Locator): Locator =>
  node.locator('.react-flow__handle');

const resizeControlOn = (node: Locator): Locator =>
  node.locator('.react-flow__resize-control');

const lengthOf = (declared: string): number => Number.parseFloat(declared);

const frameAround = async (node: Locator): Promise<number> =>
  lengthOf(
    await node.evaluate(
      (element) => getComputedStyle(element, '::after').borderTopWidth,
    ),
  );

const outlineOf = async (node: Locator): Promise<number> =>
  lengthOf(
    await node
      .locator('.pn-shape')
      .first()
      .evaluate((shape) => getComputedStyle(shape).strokeWidth),
  );

const weightOf = async (line: Locator): Promise<number> =>
  lengthOf(await line.evaluate((path) => getComputedStyle(path).strokeWidth));

const drawFlow = async (page: Page): Promise<Locator> => {
  await selectNode(page, actor);
  await page.keyboard.press(registeredChords['start-flow'][0]);
  await page.getByRole('option', { name: 'Store' }).press('Enter');
  const flow = nodeNamed(page, drawnFlow);
  await expect(flow).toHaveClass(/selected/u);
  return flow;
};

test('a selected element is framed heavier than the line it is drawn with, and shows the handles a flow runs from', async ({
  page,
}) => {
  await openPlaceholder(page);
  const node = nodeNamed(page, actor);

  expect(await frameAround(node)).toBe(0);
  await expect(handlesOn(node).first()).toBeHidden();

  await selectNode(page, actor);

  expect(await frameAround(node)).toBeGreaterThan(await outlineOf(node));
  await expect(handlesOn(node).first()).toBeVisible();
  expect(
    await node.evaluate(
      (element) => getComputedStyle(element, '::after').borderTopStyle,
    ),
  ).toBe('dashed');
});

test('an element under the pointer shows those same handles, and hides them once it is left', async ({
  page,
}) => {
  await openPlaceholder(page);
  const node = nodeNamed(page, actor);
  const handle = handlesOn(node).first();

  await expect(handle).toBeHidden();

  await node.hover();

  await expect(handle).toBeVisible();

  await pane(page).hover({ position: { x: 4, y: 4 } });

  await expect(handle).toBeHidden();
});

test('a flow reads heavier under the pointer, and heavier again once it is selected', async ({
  page,
}) => {
  await openPlaceholder(page);
  const flow = await drawFlow(page);
  const line = lineOf(page, drawnFlow);
  const selected = await weightOf(line);

  await selectNode(page, actor);
  await expect(flow).not.toHaveClass(/selected/u);
  const drawn = await weightOf(line);

  const on = await halfwayAlong(line);
  await page.mouse.move(on.x, on.y);
  await expect.poll(() => weightOf(line)).toBeGreaterThan(drawn);

  expect(await weightOf(line)).toBeLessThan(selected);
});

test('Select rests on the arrow while handles and flows keep their own cursors', async ({
  page,
}) => {
  await openPlaceholder(page);
  const node = nodeNamed(page, actor);

  await expect(node).toHaveCSS('cursor', 'default');
  await expect(handlesOn(node).first()).toHaveCSS('cursor', 'crosshair');
  await expect(pane(page)).toHaveCSS('cursor', 'default');

  const flow = await drawFlow(page);

  await expect(flow).toHaveCSS('cursor', 'pointer');
});

test('the tool the toolbox has active says it over the whole canvas', async ({
  page,
}) => {
  await openPlaceholder(page);
  const node = nodeNamed(page, actor);
  const tool = async (active: string): Promise<void> => {
    await canvas(page).evaluate((element, name) => {
      element.setAttribute('data-tool', name);
    }, active);
  };

  await tool('place');

  await expect(pane(page)).toHaveCSS('cursor', 'crosshair');
  await expect(node).toHaveCSS('cursor', 'crosshair');

  await tool('hand');

  await expect(pane(page)).toHaveCSS('cursor', 'grab');
  await expect(node).toHaveCSS('cursor', 'grab');

  await tool('select');

  await expect(node).toHaveCSS('cursor', 'default');
});

test('only the selected element carries side and corner resize controls with directional pointers', async ({
  page,
}) => {
  await openPlaceholder(page);
  const node = nodeNamed(page, actor);

  await expect(resizeControlOn(node)).toHaveCount(0);

  await selectNode(page, actor);

  await expect(resizeControlOn(node)).toHaveCount(8);
  await expect(page.locator('.react-flow__resize-control')).toHaveCount(8);
  await expect(
    resizeControlOn(node).filter({
      has: page.getByRole('button', {
        name: 'Resize Actor from top',
        exact: true,
      }),
    }),
  ).toHaveCSS('cursor', 'ns-resize');
  await expect(
    resizeControlOn(node).filter({
      has: page.getByRole('button', {
        name: 'Resize Actor from right',
        exact: true,
      }),
    }),
  ).toHaveCSS('cursor', 'ew-resize');
  await expect(
    resizeControlOn(node).filter({
      has: page.getByRole('button', {
        name: 'Resize Actor from top left corner',
        exact: true,
      }),
    }),
  ).toHaveCSS('cursor', 'nwse-resize');
  await expect(
    resizeControlOn(node).filter({
      has: page.getByRole('button', {
        name: 'Resize Actor from top right corner',
        exact: true,
      }),
    }),
  ).toHaveCSS('cursor', 'nesw-resize');
});

test('resize controls show pointer and keyboard focus', async ({ page }) => {
  await openPlaceholder(page);
  const node = await selectNode(page, actor);
  const top = node.getByRole('button', {
    name: 'Resize Actor from top',
    exact: true,
  });
  const corner = node.getByRole('button', {
    name: 'Resize Actor from bottom right corner',
    exact: true,
  });

  await node.focus();
  await page.keyboard.press('Tab');
  await expect(top).toBeFocused();
  await expect(top).toHaveCSS('outline-style', 'solid');

  const handle = corner.locator('..');
  const before = await handle.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await corner.hover();
  await expect
    .poll(() =>
      handle.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe(before);
});
