import { expect, test } from '@playwright/test';
import {
  beforeCanvas,
  canvasSurface,
  connectTarget,
  dragBy,
  dragOnto,
  editAnnouncement,
  elementNodes,
  nodeNamed,
  openEcluse,
  openPlaceholder,
  widthOf,
} from './studio.fixtures.js';

const paletteAdditions = [
  ['New actor', /^New actor, actor/u],
  ['New process', /^New process, process/u],
  ['New store', /^New store, store/u],
  ['New trust boundary', /^New trust boundary, trust boundary/u],
  ['New trust boundary curve', /^New trust boundary curve, trust boundary/u],
] as const;

for (const [button, drawn] of paletteAdditions) {
  test(`the palette draws a ${button.replace('New ', '')} on the canvas`, async ({
    page,
  }) => {
    await openPlaceholder(page);

    await page.getByRole('button', { name: button, exact: true }).click();

    await expect(nodeNamed(page, drawn)).toHaveCount(1);
    await expect(nodeNamed(page, drawn)).toHaveClass(/selected/u);
  });
}

test('an added element takes focus, is announced, and undo takes it back', async ({
  page,
}) => {
  await openPlaceholder(page);

  await page.getByRole('button', { name: 'New actor' }).click();

  await expect(nodeNamed(page, /^New actor, actor/u)).toBeFocused();
  await expect(editAnnouncement(page)).toHaveText('Added New actor, actor.');

  await page.getByRole('button', { name: 'Undo' }).click();

  await expect(nodeNamed(page, /^New actor, actor/u)).toHaveCount(0);
});

test('a flow is drawn by dragging from one handle to another', async ({
  page,
}) => {
  await openPlaceholder(page);
  const reader = nodeNamed(page, /^Reader, actor/u);
  const studio = nodeNamed(page, /^Studio, process/u);

  await reader.hover();
  await dragOnto(
    page,
    reader.locator('[data-handleid="right"]'),
    studio.locator('[data-handleid="left"]'),
  );

  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(editAnnouncement(page)).toHaveText(
    'Added New flow, flow, from Reader to Studio.',
  );
});

test('a flow is drawn by keyboard alone, from the selected element', async ({
  page,
}) => {
  await openPlaceholder(page);

  await beforeCanvas(page).focus();
  await page.keyboard.press('Tab');
  await expect(nodeNamed(page, /^Reader, actor/u)).toBeFocused();
  await page.keyboard.press('Enter');

  await page.keyboard.press('Shift+Tab');
  await expect(connectTarget(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('option', { name: 'Studio' }).press('Enter');
  await page.keyboard.press('Tab');
  await page.getByRole('button', { name: 'Connect' }).press('Enter');

  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(editAnnouncement(page)).toHaveText(
    'Added New flow, flow, from Reader to Studio.',
  );
});

test('the delete key removes the element, and the flows it held lose an end', async ({
  page,
}) => {
  await openEcluse(page);
  const registry = nodeNamed(page, /^Public npm registry, actor/u);
  const fetched = nodeNamed(page, /^anonymous packument/u);

  await registry.click();
  await expect(fetched).toHaveAttribute(
    'aria-label',
    /to Public npm registry/u,
  );

  await page.keyboard.press('Delete');

  await expect(elementNodes(page)).toHaveCount(17);
  await expect(editAnnouncement(page)).toHaveText(
    'Removed Public npm registry, actor. 2 flows detached, 1 threat link dropped.',
  );
  await expect(fetched).toHaveAttribute('aria-label', /to a free point/u);
  await expect(canvasSurface(page)).toBeFocused();
});

test('the delete key removes a selected flow, and undo puts it back', async ({
  page,
}) => {
  await openEcluse(page);
  const flows = page.locator('.react-flow__edge');

  await beforeCanvas(page).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1);

  await page.keyboard.press('Delete');

  await expect(flows).toHaveCount(19);
  await expect(editAnnouncement(page)).toContainText('Removed npm read');
  await expect(canvasSurface(page)).toBeFocused();

  await page.getByRole('button', { name: 'Undo' }).click();

  await expect(flows).toHaveCount(20);
});

test('a deletion is one step, so undo puts the element and its flows back', async ({
  page,
}) => {
  await openEcluse(page);

  await nodeNamed(page, /^Public npm registry, actor/u).click();
  await page.keyboard.press('Delete');
  await expect(elementNodes(page)).toHaveCount(17);

  await page.getByRole('button', { name: 'Undo' }).click();

  await expect(elementNodes(page)).toHaveCount(18);
  await expect(nodeNamed(page, /^anonymous packument/u)).toHaveAttribute(
    'aria-label',
    /to Public npm registry/u,
  );
});

test('a trust boundary is resized by dragging its corner, in one step', async ({
  page,
}) => {
  await openPlaceholder(page);

  await page
    .getByRole('button', { name: 'New trust boundary', exact: true })
    .click();
  const boundary = nodeNamed(page, /^New trust boundary, trust boundary/u);
  const corner = boundary.locator('.react-flow__resize-control.handle');
  await expect(corner).toBeInViewport();
  const before = await widthOf(boundary);

  await dragBy(page, corner, 40);

  await expect.poll(() => widthOf(boundary)).not.toBe(before);

  await page.getByRole('button', { name: 'Undo' }).click();

  await expect.poll(() => widthOf(boundary)).toBe(before);
});
