import { expect, test, type Locator, type Page } from '@playwright/test';
import { lineOf, type Point } from './canvas-geometry.fixtures.js';
import {
  connectTarget,
  nodeNamed,
  openPlaceholder,
  selectNode,
} from './studio.fixtures.js';

const reader = /^Reader, actor/u;

const drawnFlow = /^New flow, flow, from Reader to Studio/u;

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

const halfwayAlong = (line: Locator): Promise<Point> =>
  line.evaluate<Point, SVGPathElement>((path) => {
    const along = path.getPointAtLength(path.getTotalLength() / 2);
    const point = new DOMPoint(along.x, along.y).matrixTransform(
      path.getScreenCTM() ?? new DOMMatrix(),
    );
    return { x: point.x, y: point.y };
  });

const drawFlow = async (page: Page): Promise<Locator> => {
  await selectNode(page, reader);
  await connectTarget(page).press('Enter');
  await page.getByRole('option', { name: 'Studio' }).press('Enter');
  await page.getByRole('button', { name: 'Connect' }).click();
  const flow = nodeNamed(page, drawnFlow);
  await expect(flow).toHaveClass(/selected/u);
  return flow;
};

test('a selected element is framed heavier than the line it is drawn with, and shows the handles a flow runs from', async ({
  page,
}) => {
  await openPlaceholder(page);
  const node = nodeNamed(page, reader);

  expect(await frameAround(node)).toBe(0);
  await expect(handlesOn(node).first()).toBeHidden();

  await selectNode(page, reader);

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
  const node = nodeNamed(page, reader);
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

  await selectNode(page, reader);
  await expect(flow).not.toHaveClass(/selected/u);
  const drawn = await weightOf(line);

  const on = await halfwayAlong(line);
  await page.mouse.move(on.x, on.y);
  await expect.poll(() => weightOf(line)).toBeGreaterThan(drawn);

  expect(await weightOf(line)).toBeLessThan(selected);
});

test('the pointer says what a click would do, over an element, a handle, a flow and the background', async ({
  page,
}) => {
  await openPlaceholder(page);
  const node = nodeNamed(page, reader);

  await expect(node).toHaveCSS('cursor', 'pointer');
  await expect(handlesOn(node).first()).toHaveCSS('cursor', 'crosshair');
  await expect(pane(page)).toHaveCSS('cursor', 'grab');

  const flow = await drawFlow(page);

  await expect(flow).toHaveCSS('cursor', 'pointer');
});

test('the tool the toolbox has active says it over the whole canvas', async ({
  page,
}) => {
  await openPlaceholder(page);
  const node = nodeNamed(page, reader);
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

  await expect(node).toHaveCSS('cursor', 'pointer');
});

test('only the selected element carries the control that resizes it, and the pointer names the direction', async ({
  page,
}) => {
  await openPlaceholder(page);
  const node = nodeNamed(page, reader);

  await expect(resizeControlOn(node)).toHaveCount(0);

  await selectNode(page, reader);

  await expect(resizeControlOn(node)).toHaveCount(1);
  await expect(page.locator('.react-flow__resize-control')).toHaveCount(1);
  await expect(resizeControlOn(node)).toHaveCSS('cursor', 'nwse-resize');
});
