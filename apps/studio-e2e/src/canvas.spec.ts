import { expect, test } from '@playwright/test';
import {
  beforeCanvas,
  connectTarget,
  dragBy,
  elementNodes,
  nodeNamed,
  openEcluse,
  openPlaceholder,
  placeOf,
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

  await connectTarget(page).focus();
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

test('an element is reachable, selectable and movable by keyboard alone', async ({
  page,
}) => {
  await openPlaceholder(page);
  const reader = nodeNamed(page, /^Reader, actor/u);

  await beforeCanvas(page).focus();
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
