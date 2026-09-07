import { expect, test, type Locator, type Page } from '@playwright/test';
import { halfwayAlong, lineOf } from './canvas-geometry.fixtures.js';
import {
  beforeCanvas,
  canvasSettled,
  canvasSurface,
  centreOf,
  dragBy,
  dragOnto,
  elementNodes,
  handleOn,
  nodeNamed,
  openEcluse,
  openPlaceholder,
  placeOf,
  runFromMenu,
  selectNode,
  toolButton,
} from './studio.fixtures.js';

const boundaryHandlePoint = async (
  boundary: Locator,
  side: 'top' | 'bottom',
): Promise<{ readonly x: number; readonly y: number }> =>
  centreOf(handleOn(boundary, side));

const expectBoundaryHitTarget = async (
  page: Page,
  at: { readonly x: number; readonly y: number },
): Promise<void> => {
  await page.mouse.move(at.x, at.y);
  const target = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('class') ?? '',
    at,
  );
  expect(target).toContain('pn-boundary-hit-target');
};

const dragFromBoundaryHandle = async (
  page: Page,
  boundary: Locator,
  side: 'top' | 'bottom',
): Promise<void> => {
  await canvasSettled(page);
  const from = await boundaryHandlePoint(boundary, side);
  await expectBoundaryHitTarget(page, from);
  const before = await placeOf(boundary);

  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + 30, { steps: 8 });
  await expect(boundary).toHaveClass(/dragging/u);
  await page.mouse.up();

  await expect.poll(() => placeOf(boundary)).not.toBe(before);
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

  const onOutline = await boundaryHandlePoint(boundary, 'bottom');
  await expectBoundaryHitTarget(page, onOutline);
  await page.mouse.click(onOutline.x, onOutline.y);
  await expect(boundary).toHaveClass(/selected/u);
  await dragFromBoundaryHandle(page, boundary, 'bottom');
});

test('a curve boundary drags where its outline crosses a disabled handle', async ({
  page,
}) => {
  await openPlaceholder(page);
  await toolButton(page, 'Trust boundary curve').click();
  await canvasSurface(page).focus();
  await page.keyboard.press('Enter');
  const boundary = nodeNamed(page, /^New trust boundary curve/u);
  await expect(boundary).toHaveClass(/selected/u);
  await page.keyboard.press('Enter');

  await dragFromBoundaryHandle(page, boundary, 'top');
});

test('a selected regular node stays above a later overlapping node', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = await selectNode(page, /^Actor, actor/u);
  const store = nodeNamed(page, /^Store, store/u);
  await dragOnto(page, actor, store);
  const actorBox = await actor.boundingBox();
  const storeBox = await store.boundingBox();
  expect(actorBox).not.toBeNull();
  expect(storeBox).not.toBeNull();
  const overlap = {
    left: Math.max(actorBox?.x ?? 0, storeBox?.x ?? 0),
    top: Math.max(actorBox?.y ?? 0, storeBox?.y ?? 0),
    right: Math.min(
      (actorBox?.x ?? 0) + (actorBox?.width ?? 0),
      (storeBox?.x ?? 0) + (storeBox?.width ?? 0),
    ),
    bottom: Math.min(
      (actorBox?.y ?? 0) + (actorBox?.height ?? 0),
      (storeBox?.y ?? 0) + (storeBox?.height ?? 0),
    ),
  };
  expect(overlap.right).toBeGreaterThan(overlap.left);
  expect(overlap.bottom).toBeGreaterThan(overlap.top);
  const sharedCentre = {
    x: (overlap.left + overlap.right) / 2,
    y: (overlap.top + overlap.bottom) / 2,
  };

  const top = await page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest('.react-flow__node')
        ?.getAttribute('data-id'),
    sharedCentre,
  );
  expect(top).toBe(await actor.getAttribute('data-id'));
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
