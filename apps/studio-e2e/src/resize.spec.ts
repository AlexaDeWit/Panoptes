import { expect, test, type Locator } from '@playwright/test';
import {
  boxOf,
  pressOn,
  type Box,
  type Point,
} from './canvas-geometry.fixtures.js';
import { viewportZoom } from './commands.fixtures.js';
import {
  dragBy,
  openPlaceholder,
  runFromMenu,
  selectNode,
  toolButton,
} from './studio.fixtures.js';

const actor = /^Actor, actor/u;
const pointerTolerance = 1;

const sideCases = [
  ['top', { x: 0, y: -40 }, 'height'],
  ['right', { x: 40, y: 0 }, 'width'],
  ['bottom', { x: 0, y: 40 }, 'height'],
  ['left', { x: -40, y: 0 }, 'width'],
] as const;

const shrinkingCases = [
  ['top', { x: 0, y: 400 }, 'height'],
  ['right', { x: -400, y: 0 }, 'width'],
  ['bottom', { x: 0, y: -400 }, 'height'],
  ['left', { x: 400, y: 0 }, 'width'],
] as const;

const sideControl = (node: Locator, side: string): Locator =>
  node.getByRole('button', {
    name: `Resize Actor from ${side}`,
    exact: true,
  });

const expectFixedOpposite = (side: string, before: Box, after: Box): void => {
  if (side === 'top') {
    expect(after.y + after.height).toBeCloseTo(before.y + before.height);
  } else if (side === 'right') {
    expect(after.x).toBeCloseTo(before.x);
  } else if (side === 'bottom') {
    expect(after.y).toBeCloseTo(before.y);
  } else {
    expect(after.x + after.width).toBeCloseTo(before.x + before.width);
  }
};

const expectOtherAxisFixed = (side: string, before: Box, after: Box): void => {
  if (side === 'top' || side === 'bottom') {
    expect(after.x).toBeCloseTo(before.x);
    expect(after.width).toBeCloseTo(before.width);
  } else {
    expect(after.y).toBeCloseTo(before.y);
    expect(after.height).toBeCloseTo(before.height);
  }
};

for (const [side, offset, changed] of sideCases) {
  test(`dragging the ${side} control changes only its axis and fixes the opposite side`, async ({
    page,
  }) => {
    await openPlaceholder(page);
    const node = await selectNode(page, actor);
    const before = await boxOf(node);

    await dragBy(page, sideControl(node, side), offset);
    await expect
      .poll(async () => (await boxOf(node))[changed])
      .not.toBe(before[changed]);
    const after = await boxOf(node);

    expectFixedOpposite(side, before, after);
    expectOtherAxisFixed(side, before, after);
  });
}

test('the glyph follows the selection bounds during a resize drag', async ({
  page,
}) => {
  await openPlaceholder(page);
  const node = await selectNode(page, actor);
  const glyph = node.locator('svg').first();
  const before = Number(await glyph.getAttribute('width'));
  const from = await pressOn(page, sideControl(node, 'right'));

  await page.mouse.move(from.x + 40, from.y, { steps: 8 });
  await expect
    .poll(async () => Number(await glyph.getAttribute('width')))
    .not.toBe(before);
  expect(Number(await glyph.getAttribute('width'))).toBeCloseTo(
    (await boxOf(node)).width,
  );

  await page.mouse.up();
});

for (const [side, offset, changed] of shrinkingCases) {
  test(`the ${side} control stops at the minimum size`, async ({ page }) => {
    await openPlaceholder(page);
    const node = await selectNode(page, actor);
    const before = await boxOf(node);

    await dragBy(page, sideControl(node, side), offset);
    await expect.poll(async () => (await boxOf(node))[changed]).toBe(10);

    expectFixedOpposite(side, before, await boxOf(node));
  });
}

test('a no-op resize at the minimum leaves later geometry settled', async ({
  page,
}) => {
  await openPlaceholder(page);
  const node = await selectNode(page, actor);
  const right = sideControl(node, 'right');

  await dragBy(page, right, { x: -400, y: 0 });
  await expect.poll(async () => (await boxOf(node)).width).toBe(10);
  await pressOn(page, right);
  await page.mouse.up();

  await runFromMenu(page, 'Undo');
  await expect.poll(async () => (await boxOf(node)).width).toBeGreaterThan(10);
  expect(Number(await node.locator('svg').first().getAttribute('width'))).toBe(
    (await boxOf(node)).width,
  );
});

test('a corner resizes both axes in one undo step', async ({ page }) => {
  await openPlaceholder(page);
  const node = await selectNode(page, actor);
  const before = await boxOf(node);
  const corner = node
    .getByRole('button', {
      name: 'Resize Actor from top left corner',
      exact: true,
    })
    .locator('..');

  await dragBy(page, corner, { x: -40, y: -40 });
  await expect.poll(async () => (await boxOf(node)).x).not.toBe(before.x);
  const resized = await boxOf(node);
  expect(resized.width).not.toBe(before.width);
  expect(resized.height).not.toBe(before.height);

  await runFromMenu(page, 'Undo');

  await expect.poll(() => boxOf(node)).toEqual(before);
});

test('pan and zoom preserve the model-space resize result', async ({
  page,
}) => {
  await openPlaceholder(page);
  let node = await selectNode(page, actor);
  const original = await boxOf(node);
  const modelOffset = 20;
  await dragBy(page, sideControl(node, 'right'), {
    x: modelOffset * (await viewportZoom(page)),
    y: 0,
  });
  await expect
    .poll(async () => (await boxOf(node)).width)
    .not.toBe(original.width);
  const plainDelta = (await boxOf(node)).width - original.width;
  await runFromMenu(page, 'Undo');

  await page.getByRole('button', { name: 'Zoom out' }).click();
  await toolButton(page, 'Hand').click();
  await dragBy(page, page.locator('.react-flow__pane'), { x: 80, y: 40 });
  await toolButton(page, 'Select').click();

  node = await selectNode(page, actor);
  const before = await boxOf(node);
  const offset: Point = { x: modelOffset * (await viewportZoom(page)), y: 0 };

  await dragBy(page, sideControl(node, 'right'), offset);
  await expect
    .poll(async () => (await boxOf(node)).width)
    .not.toBe(before.width);
  const after = await boxOf(node);
  expect(Math.abs(after.width - before.width - plainDelta)).toBeLessThanOrEqual(
    pointerTolerance,
  );
  expect(after.x).toBeCloseTo(before.x);
  expect(after.y).toBeCloseTo(before.y);
});

test('arrow keys resize from a focused side control', async ({ page }) => {
  await openPlaceholder(page);
  const node = await selectNode(page, actor);
  const before = await boxOf(node);
  const top = node.getByRole('button', {
    name: 'Resize Actor from top',
    exact: true,
  });

  await top.focus();
  await top.press('ArrowUp');

  await expect.poll(async () => (await boxOf(node)).y).toBe(before.y - 5);
  const after = await boxOf(node);
  expect(after.height).toBe(before.height + 5);
  expect(after.y + after.height).toBe(before.y + before.height);
});
