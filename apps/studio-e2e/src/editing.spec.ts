import { expect, test } from '@playwright/test';
import { registeredChords } from './chords.js';
import { viewportTransform } from './commands.fixtures.js';
import {
  beforeCanvas,
  canvasContainer,
  canvasSettled,
  canvasSurface,
  dragBy,
  dragOnto,
  editAnnouncement,
  elementNodes,
  emptyCanvasPoint,
  menuItem,
  nodeNamed,
  openEcluse,
  openMenu,
  openPlaceholder,
  placeByClick,
  runFromMenu,
  selectNode,
  toolButton,
  vendored,
  widthOf,
  withoutPickers,
} from './studio.fixtures.js';

const boxTools = [
  ['Actor', /^New actor, actor/u],
  ['Process', /^New process, process/u],
  ['Store', /^New store, store/u],
  ['Trust boundary', /^New trust boundary, trust boundary/u],
] as const;

const keyboardTools = [
  [registeredChords['actor-tool'][0], /^New actor, actor/u],
  [registeredChords['process-tool'][0], /^New process, process/u],
  [registeredChords['store-tool'][0], /^New store, store/u],
  [registeredChords['boundary-box-tool'][0], /^New trust boundary, trust/u],
  [registeredChords['boundary-curve-tool'][0], /^New trust boundary curve/u],
] as const;

for (const [tool, drawn] of boxTools) {
  test(`the ${tool} tool places its element by pointer`, async ({ page }) => {
    await openPlaceholder(page);

    const placed = await placeByClick(page, tool, drawn);

    await expect(placed).toHaveClass(/selected/u);
    await expect(
      page.getByRole('textbox', {
        name: new RegExp(
          `^Name of ${tool === 'Trust boundary' ? 'New trust boundary' : `New ${tool.toLowerCase()}`}$`,
          'u',
        ),
      }),
    ).toBeFocused();
  });
}

test('each element tool key selects its mode and Enter places it', async ({
  page,
}) => {
  await openPlaceholder(page);

  for (const [chord, named] of keyboardTools) {
    await page.keyboard.press(chord);
    await page.keyboard.press('Enter');
    await expect(nodeNamed(page, named)).toHaveCount(1);
    await expect(
      page.getByRole('textbox', { name: /^Name of New/u }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
  }
  await expect(elementNodes(page)).toHaveCount(7);
});

test('Select clears a selected element when the pointer lands on empty canvas', async ({
  page,
}) => {
  await openPlaceholder(page);
  await toolButton(page, 'Select').click();
  const actor = await selectNode(page, /^Actor, actor/u);
  const empty = await emptyCanvasPoint(page);

  await page.mouse.click(empty.x, empty.y);

  await expect(actor).not.toHaveClass(/selected/u);
  await expect(canvasContainer(page)).toHaveAttribute(
    'data-active-tool',
    'select',
  );
});

test('Enter and Space activate a focused toolbox button', async ({ page }) => {
  await openPlaceholder(page);

  await toolButton(page, 'Actor').click();
  await toolButton(page, 'Store').focus();
  await page.keyboard.press('Enter');
  await expect(canvasContainer(page)).toHaveAttribute(
    'data-active-tool',
    'store',
  );

  await toolButton(page, 'Actor').focus();
  await page.keyboard.press('Space');
  await expect(canvasContainer(page)).toHaveAttribute(
    'data-active-tool',
    'actor',
  );
  await expect(elementNodes(page)).toHaveCount(2);
});

test('changing tools cancels a box drag before pointer release', async ({
  page,
}) => {
  await openPlaceholder(page);
  const at = await emptyCanvasPoint(page);

  await toolButton(page, 'Actor').click();
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.keyboard.press(registeredChords['select-tool'][1]);
  await page.mouse.up();

  await expect(nodeNamed(page, /^New actor, actor/u)).toHaveCount(0);
  await openMenu(page);
  await expect(menuItem(page, 'Undo')).toHaveAttribute('aria-disabled', 'true');
});

test('the attribution link remains a link in boundary curve mode', async ({
  page,
}) => {
  await openPlaceholder(page);
  await toolButton(page, 'Trust boundary curve').click();

  const prevented = await page
    .getByRole('link', { name: 'React Flow attribution' })
    .evaluate((link) => {
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        detail: 1,
      });
      link.dispatchEvent(event);
      return event.defaultPrevented;
    });

  expect(prevented).toBe(false);
  await expect(page.getByTestId('curve-draft')).toHaveCount(0);
});

test('the boundary curve tool adds waypoints and double click finishes it', async ({
  page,
}) => {
  await openPlaceholder(page);
  const canvas = await canvasContainer(page).boundingBox();
  expect(canvas).not.toBeNull();
  const first = {
    x: (canvas?.x ?? 0) + (canvas?.width ?? 0) * 0.65,
    y: (canvas?.y ?? 0) + (canvas?.height ?? 0) * 0.65,
  };
  const last = { x: first.x + 80, y: first.y + 50 };

  await toolButton(page, 'Trust boundary curve').click();
  await page.mouse.click(first.x, first.y);
  await expect(page.getByTestId('curve-draft').locator('circle')).toHaveCount(
    1,
  );
  await page.mouse.dblclick(last.x, last.y);

  await expect(
    nodeNamed(page, /^New trust boundary curve, trust boundary/u),
  ).toHaveCount(1);
  await expect(canvasContainer(page)).toHaveAttribute(
    'data-active-tool',
    'select',
  );
});

test('Enter finishes a boundary curve after two waypoint clicks', async ({
  page,
}) => {
  await openPlaceholder(page);
  const first = await emptyCanvasPoint(page);

  await toolButton(page, 'Trust boundary curve').click();
  await page.mouse.click(first.x, first.y);
  await page.mouse.click(first.x + 80, first.y + 50);
  await page.keyboard.press('Enter');

  await expect(
    nodeNamed(page, /^New trust boundary curve, trust boundary/u),
  ).toHaveCount(1);
});

test('a placed element opens its name, is announced, and undo takes it back as one step', async ({
  page,
}) => {
  await openPlaceholder(page);

  await placeByClick(page, 'Actor', /^New actor, actor/u);

  await expect(
    page.getByRole('textbox', { name: 'Name of New actor' }),
  ).toBeFocused();
  await expect(page.getByRole('region', { name: 'Threats' })).toBeVisible();
  await expect(editAnnouncement(page)).toContainText('New actor');
  await page.keyboard.press('Enter');

  await runFromMenu(page, 'Undo');

  await expect(nodeNamed(page, /^New actor, actor/u)).toHaveCount(0);
});

test('a flow is drawn by dragging from one handle to another', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, /^Actor, actor/u);
  const store = nodeNamed(page, /^Store, store/u);

  await actor.hover();
  await dragOnto(
    page,
    actor.locator('[data-handleid="right"]'),
    store.locator('[data-handleid="left"]'),
  );

  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await expect(editAnnouncement(page)).toContainText('Actor');
  await expect(editAnnouncement(page)).toContainText('Store');
});

test('a flow is drawn by keyboard alone, from the selected element', async ({
  page,
}) => {
  await openPlaceholder(page);

  await selectNode(page, /^Actor, actor/u);
  await page.keyboard.press(registeredChords['start-flow'][0]);
  await page.getByRole('option', { name: 'Store' }).press('Enter');

  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await expect(editAnnouncement(page)).toContainText('Actor');
  await expect(editAnnouncement(page)).toContainText('Store');
});

test('a pointer drag sizes a process to its shorter side', async ({ page }) => {
  await openPlaceholder(page);
  const from = await emptyCanvasPoint(page);

  await toolButton(page, 'Process').click();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 140, from.y + 70, { steps: 8 });
  await page.mouse.up();

  const box = await nodeNamed(page, /^New process, process/u).boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width).toBeCloseTo(box?.height ?? 0, 0);
});

test('double clicking an element tool locks it until Escape', async ({
  page,
}) => {
  await openPlaceholder(page);
  const first = await emptyCanvasPoint(page);

  await toolButton(page, 'Actor').dblclick();
  await expect(canvasContainer(page)).toHaveAttribute(
    'data-active-tool',
    'actor',
  );
  await page.mouse.click(first.x, first.y);
  await page.keyboard.press('Enter');
  const second = await emptyCanvasPoint(page);
  await page.mouse.click(second.x, second.y);

  await expect(nodeNamed(page, /^New actor, actor/u)).toHaveCount(2);
  await expect(canvasContainer(page)).toHaveAttribute(
    'data-active-tool',
    'actor',
  );

  await page.keyboard.press(registeredChords['select-tool'][1]);
  await page.keyboard.press(registeredChords['select-tool'][1]);
  await expect(canvasContainer(page)).toHaveAttribute(
    'data-active-tool',
    'select',
  );
});

test('Escape discards a boundary curve without an undo step', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = await nodeNamed(page, /^Actor, actor/u).boundingBox();
  expect(actor).not.toBeNull();
  const at = {
    x: (actor?.x ?? 0) + (actor?.width ?? 0) / 2,
    y: (actor?.y ?? 0) + (actor?.height ?? 0) / 2,
  };

  await toolButton(page, 'Trust boundary curve').click();
  await page.mouse.click(at.x, at.y);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('curve-draft').locator('circle')).toHaveCount(
    1,
  );
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await expect(page.getByTestId('curve-draft').locator('circle')).toHaveCount(
    1,
  );
  await page.keyboard.press(registeredChords['select-tool'][1]);

  await expect(
    nodeNamed(page, /^New trust boundary curve, trust boundary/u),
  ).toHaveCount(0);
  await openMenu(page);
  await expect(menuItem(page, 'Undo')).toHaveAttribute('aria-disabled', 'true');
});

test('opening another model clears a boundary curve draft', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openPlaceholder(page);
  const at = await emptyCanvasPoint(page);

  await toolButton(page, 'Trust boundary curve').click();
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId('curve-draft')).toBeVisible();

  await page
    .getByTestId('file-input')
    .setInputFiles(vendored('test-data/saerskriven/ecluse.yaml'));
  await canvasSettled(page);

  await expect(page.getByTestId('curve-draft')).toHaveCount(0);
});

test('a boundary curve draft stays discarded across undo and redo', async ({
  page,
}) => {
  await openPlaceholder(page);
  await placeByClick(page, 'Actor', /^New actor, actor/u);
  await expect(
    page.getByRole('textbox', { name: 'Name of New actor' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  const at = await emptyCanvasPoint(page);
  await toolButton(page, 'Trust boundary curve').click();
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId('curve-draft')).toBeVisible();

  await runFromMenu(page, 'Undo');
  await expect(page.getByTestId('curve-draft')).toHaveCount(0);
  await runFromMenu(page, 'Redo');

  await expect(page.getByTestId('curve-draft')).toHaveCount(0);
});

test('Hand pans from anywhere and Space restores the previous tool', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = await nodeNamed(page, /^Actor, actor/u).boundingBox();
  expect(actor).not.toBeNull();
  const at = {
    x: (actor?.x ?? 0) + (actor?.width ?? 0) / 2,
    y: (actor?.y ?? 0) + (actor?.height ?? 0) / 2,
  };
  const before = await viewportTransform(page);

  await toolButton(page, 'Hand').click();
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 80, at.y + 50, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => viewportTransform(page)).not.toBe(before);

  await toolButton(page, 'Actor').click();
  await page.keyboard.press(registeredChords['hand-tool'][0]);
  await expect(canvasContainer(page)).toHaveAttribute(
    'data-active-tool',
    'hand',
  );
  await toolButton(page, 'Actor').click();
  await canvasSurface(page).focus();
  await page.keyboard.down(registeredChords['hand-tool'][1]);
  await expect(canvasContainer(page)).toHaveAttribute(
    'data-active-tool',
    'hand',
  );
  await page.keyboard.up(registeredChords['hand-tool'][1]);
  await expect(canvasContainer(page)).toHaveAttribute(
    'data-active-tool',
    'actor',
  );
});

test('the canvas owns the full viewport beneath its floating chrome', async ({
  page,
}) => {
  await openPlaceholder(page);

  const canvas = await canvasContainer(page).boundingBox();
  const viewport = page.viewportSize();
  expect(canvas).toEqual({
    x: 0,
    y: 0,
    width: viewport?.width,
    height: viewport?.height,
  });
  await expect(page.getByTestId('toolbox')).toBeInViewport();
  await expect(page.getByRole('button', { name: /^Menu/u })).toBeInViewport();
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
  await expect(editAnnouncement(page)).toContainText('Public npm registry');
  await expect(editAnnouncement(page)).toContainText('2');
  await expect(editAnnouncement(page)).toContainText('1');
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

  await runFromMenu(page, 'Undo');

  await expect(flows).toHaveCount(20);
});

test('a deletion is one step, so undo puts the element and its flows back', async ({
  page,
}) => {
  await openEcluse(page);

  await nodeNamed(page, /^Public npm registry, actor/u).click();
  await page.keyboard.press('Delete');
  await expect(elementNodes(page)).toHaveCount(17);

  await runFromMenu(page, 'Undo');

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

  const boundary = await placeByClick(
    page,
    'Trust boundary',
    /^New trust boundary, trust boundary/u,
  );
  await page.keyboard.press('Enter');
  const corner = boundary.locator('.react-flow__resize-control.handle');
  await expect(corner).toBeInViewport();
  const before = await widthOf(boundary);

  await dragBy(page, corner, 40);

  await expect.poll(() => widthOf(boundary)).not.toBe(before);

  await runFromMenu(page, 'Undo');

  await expect.poll(() => widthOf(boundary)).toBe(before);
});
