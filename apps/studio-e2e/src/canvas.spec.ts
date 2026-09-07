import { expect, test } from '@playwright/test';
import { halfwayAlong, lineOf } from './canvas-geometry.fixtures.js';
import {
  beforeCanvas,
  canvasSettled,
  dragBy,
  elementNodes,
  nodeNamed,
  openEcluse,
  openPlaceholder,
  placeOf,
  runFromMenu,
} from './studio.fixtures.js';

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

  await beforeCanvas(page).focus();
  await page.keyboard.press('Tab');

  await expect(page.locator('.react-flow__edge:focus')).toHaveCount(1);
});

test('a click selects an element and the canvas draws the selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, /^Actor, actor/u);

  await actor.click();

  await expect(actor).toHaveClass(/selected/u);
  await expect(nodeNamed(page, /^Store, store/u)).not.toHaveClass(/selected/u);
});

test('the selection moves between an element and a flow, either way', async ({
  page,
}) => {
  await openEcluse(page);
  const proxy = nodeNamed(page, /^Écluse proxy, process/u);
  const selectedFlow = page.locator('.react-flow__edge.selected');

  await proxy.click();
  await expect(proxy).toHaveClass(/selected/u);

  await beforeCanvas(page).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(selectedFlow).toHaveCount(1);
  await expect(proxy).not.toHaveClass(/selected/u);

  await proxy.click();
  await expect(proxy).toHaveClass(/selected/u);
  await expect(selectedFlow).toHaveCount(0);
});

test('a flow under a selected trust boundary takes a line or label click', async ({
  page,
}) => {
  await openEcluse(page);
  const boundary = nodeNamed(page, /^Operator trust zone/u);
  const flowName = /^npm read \/ publish/u;
  const flow = nodeNamed(page, flowName);

  await boundary.locator('.pn-label').click();
  await expect(boundary).toHaveClass(/selected/u);
  await canvasSettled(page);

  const onLine = await halfwayAlong(lineOf(page, flowName));
  await page.mouse.click(onLine.x, onLine.y);
  await expect(flow).toHaveClass(/selected/u);
  await expect(boundary).not.toHaveClass(/selected/u);

  await boundary.locator('.pn-label').click();
  await canvasSettled(page);
  await flow.locator('.pn-flow-label').click();
  await expect(flow).toHaveClass(/selected/u);
  await expect(boundary).not.toHaveClass(/selected/u);
});

test('a trust boundary selects and drags from its outline', async ({
  page,
}) => {
  await openEcluse(page);
  const boundary = nodeNamed(page, /^Operator trust zone/u);
  const outlinePoint = async () => {
    const box = await boundary.boundingBox();
    expect(box).not.toBeNull();
    return {
      x: (box?.x ?? 0) + (box?.width ?? 0) / 4,
      y: (box?.y ?? 0) + 4,
    };
  };
  const onOutline = await outlinePoint();

  await page.mouse.click(onOutline.x, onOutline.y);
  await expect(boundary).toHaveClass(/selected/u);
  await canvasSettled(page);

  const dragFrom = await outlinePoint();
  const target = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('class') ?? '',
    dragFrom,
  );
  expect(target).toContain('pn-boundary-hit-target');
  const before = await placeOf(boundary);

  await page.mouse.move(dragFrom.x, dragFrom.y);
  await page.mouse.down();
  await page.mouse.move(dragFrom.x + 30, dragFrom.y + 30, { steps: 8 });
  await expect(boundary).toHaveClass(/dragging/u);
  await page.mouse.up();

  await expect.poll(() => placeOf(boundary)).not.toBe(before);
});

test('a drag moves the element through the store, and undo puts it back', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, /^Actor, actor/u);
  const before = await placeOf(actor);

  await dragBy(page, actor, 60);

  await expect.poll(() => placeOf(actor)).not.toBe(before);

  await runFromMenu(page, 'Undo');

  await expect.poll(() => placeOf(actor)).toBe(before);
});

test('an element is reachable, selectable and movable by keyboard alone', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, /^Actor, actor/u);

  await beforeCanvas(page).focus();
  await page.keyboard.press('Tab');
  await expect(nodeNamed(page, /^Records, flow/u)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(actor).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(nodeNamed(page, /^Store, store/u)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(actor).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(actor).toHaveClass(/selected/u);

  const selected = await placeOf(actor);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => placeOf(actor)).not.toBe(selected);

  await runFromMenu(page, 'Undo');
  await expect.poll(() => placeOf(actor)).toBe(selected);
});
