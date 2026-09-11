import { expect, test, type Locator, type Page } from '@playwright/test';
import { viewportTransform, viewportZoom } from './commands.fixtures.js';
import {
  nodeNamed,
  openEcluse,
  openFile,
  openPlaceholder,
} from './studio.fixtures.js';

const nowhere = { x: 0, y: 0, width: 0, height: 0 };

const furthestAcross = /^OSV\.dev, actor/u;

const furthestDown = /^Écluse Dredger, process/u;

const placeholderCorner = /^Store, store/u;

const clearanceOf = async (
  page: Page,
  name: RegExp,
): Promise<Record<string, number>> => {
  const measured = await page.getByTestId('canvas-container').boundingBox();
  const drawn = await nodeNamed(page, name).boundingBox();
  expect(measured, 'the canvas is on the page').not.toBeNull();
  expect(drawn, `${name.source} is drawn`).not.toBeNull();
  const canvas = measured ?? nowhere;
  const node = drawn ?? nowhere;
  return {
    left: node.x - canvas.x,
    top: node.y - canvas.y,
    right: canvas.x + canvas.width - (node.x + node.width),
    bottom: canvas.y + canvas.height - (node.y + node.height),
  };
};

const drawnInside = async (page: Page, name: RegExp): Promise<void> => {
  const clear = await clearanceOf(page, name);
  expect(
    Math.min(...Object.values(clear)),
    `${name.source} sits inside the canvas: ${JSON.stringify(clear)}`,
  ).toBeGreaterThan(0);
};

const clusterRegion = (page: Page): Locator =>
  page.getByRole('region', { name: 'Zoom and fit' });

const clearOfTheCluster = async (page: Page, name: RegExp): Promise<void> => {
  const floating = await clusterRegion(page).boundingBox();
  const drawn = await nodeNamed(page, name).boundingBox();
  expect(floating, 'the cluster is on the page').not.toBeNull();
  expect(drawn, `${name.source} is drawn`).not.toBeNull();
  const cluster = floating ?? nowhere;
  const node = drawn ?? nowhere;

  expect(
    cluster.y - (node.y + node.height),
    `${name.source} clears the cluster the padding keeps room for`,
  ).toBeGreaterThan(0);
};

test('a real model opens fitted, so the elements at its far corners are drawn inside the canvas', async ({
  page,
}) => {
  await openEcluse(page);

  await drawnInside(page, furthestAcross);
  await drawnInside(page, furthestDown);
  await clearOfTheCluster(page, furthestDown);
});

test('the placeholder opens fitted as well', async ({ page }) => {
  await openPlaceholder(page);

  await drawnInside(page, placeholderCorner);
  expect(
    await viewportZoom(page),
    'the placeholder is drawn larger than life, which only a fit does',
  ).toBeGreaterThan(1);
});

test('selecting an element at the edge does not snap the viewport to centre it', async ({
  page,
}) => {
  await openEcluse(page);
  const node = nodeNamed(page, furthestAcross);
  const before = await viewportTransform(page);

  await node.click();
  await expect(node).toHaveClass(/selected/u);
  await expect.poll(() => viewportTransform(page)).toBe(before);
});

test('a file opened over the model on screen is fitted again', async ({
  page,
}) => {
  await openFile(page, 'test-data/ecluse.json');

  await drawnInside(page, furthestAcross);
  await drawnInside(page, furthestDown);
});

test('the cluster floats over the bottom right corner of the canvas', async ({
  page,
}) => {
  await openPlaceholder(page);

  const measured = await page.getByTestId('canvas-container').boundingBox();
  const floating = await clusterRegion(page).boundingBox();
  expect(measured, 'the canvas is on the page').not.toBeNull();
  expect(floating, 'the cluster is on the page').not.toBeNull();
  const canvas = measured ?? nowhere;
  const cluster = floating ?? nowhere;

  expect(cluster.x).toBeGreaterThan(canvas.x + canvas.width / 2);
  expect(cluster.y).toBeGreaterThan(canvas.y + canvas.height / 2);
  expect(cluster.x + cluster.width).toBeLessThanOrEqual(
    canvas.x + canvas.width,
  );
  expect(cluster.y + cluster.height).toBeLessThanOrEqual(
    canvas.y + canvas.height,
  );
});

test('the cluster zooms and fits by pointer, and says which chord does the same', async ({
  page,
}) => {
  await openEcluse(page);
  const fitted = await viewportTransform(page);

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(async () => viewportTransform(page)).not.toBe(fitted);
  const closer = await viewportTransform(page);

  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect.poll(async () => viewportTransform(page)).not.toBe(closer);

  await page.getByRole('button', { name: 'Fit to view' }).click();
  await expect.poll(async () => viewportTransform(page)).toBe(fitted);
  await drawnInside(page, furthestAcross);
});

test('each control in the cluster says which chord runs it, to a pointer and to a reader alike', async ({
  page,
}) => {
  await openPlaceholder(page);
  const tooltip = page.getByRole('tooltip');
  const fit = page.getByRole('button', { name: 'Fit to view' });

  await expect(fit).toHaveAttribute('aria-keyshortcuts', 'Control+0');
  await fit.hover();
  await expect(tooltip).toContainText('Ctrl+0');

  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);

  await page.getByRole('button', { name: 'Zoom in' }).focus();

  await expect(tooltip).toContainText('Ctrl+=');
});
