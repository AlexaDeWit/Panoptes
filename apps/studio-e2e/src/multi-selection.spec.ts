import { expect, test, type Page } from '@playwright/test';
import { boxOf, drawnBy, lineOf } from './canvas-geometry.fixtures.js';
import {
  boxSelect,
  canvasSettled,
  dragBy,
  editAnnouncement,
  elementNodes,
  nodeNamed,
  openEcluse,
  openPlaceholder,
  runFromMenu,
  selectNode,
  threatPanel,
} from './studio.fixtures.js';

const actorName = /^Actor, actor/u;
const storeName = /^Store, store/u;

const placeholderNodes = (page: Page) => [
  nodeNamed(page, actorName),
  nodeNamed(page, storeName),
];

test('a background drag selects every element wholly inside its box', async ({
  page,
}) => {
  await openPlaceholder(page);
  const [actor, store] = placeholderNodes(page);

  await boxSelect(page, [actor, store]);

  await expect(actor).toHaveClass(/selected/u);
  await expect(store).toHaveClass(/selected/u);
  await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1);
  await expect(threatPanel(page)).toContainText('3 elements selected');
  await expect(
    threatPanel(page).getByRole('button', { name: 'Add a threat' }),
  ).toHaveCount(0);
});

test('a box around one node leaves its attached flow out', async ({ page }) => {
  await openPlaceholder(page);
  const [actor, store] = placeholderNodes(page);

  await boxSelect(page, [actor]);

  await expect(actor).toHaveClass(/selected/u);
  await expect(store).not.toHaveClass(/selected/u);
  await expect(page.locator('.react-flow__edge.selected')).toHaveCount(0);
});

test('Shift-click and Shift+Enter extend and trim the selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  const [actor, store] = placeholderNodes(page);
  const flow = nodeNamed(page, /^Records, flow/u);

  await actor.click();
  await store.click({ modifiers: ['Shift'] });
  await expect(actor).toHaveClass(/selected/u);
  await expect(store).toHaveClass(/selected/u);

  await store.click({ modifiers: ['Shift'] });
  await expect(store).not.toHaveClass(/selected/u);

  await store.focus();
  await page.keyboard.press('Shift+Enter');
  await expect(actor).toHaveClass(/selected/u);
  await expect(store).toHaveClass(/selected/u);

  await page.keyboard.press('ControlOrMeta+a');
  await flow.focus();
  await page.keyboard.press('Shift+Enter');
  await expect(flow).not.toHaveClass(/selected/u);
  await page.keyboard.press('Shift+Enter');
  await expect(flow).toHaveClass(/selected/u);
});

test('a plain click or Enter reduces a group to that element', async ({
  page,
}) => {
  await openPlaceholder(page);
  const [actor, store] = placeholderNodes(page);
  await boxSelect(page, [actor, store]);

  await actor.click();

  await expect(actor).toHaveClass(/selected/u);
  await expect(store).not.toHaveClass(/selected/u);
  await expect(threatPanel(page)).toContainText('Threats on Actor');

  await page.keyboard.press('ControlOrMeta+a');
  const flow = nodeNamed(page, /^Records, flow/u);
  await flow.focus();
  await page.keyboard.press('Enter');

  await expect(flow).toHaveClass(/selected/u);
  await expect(actor).not.toHaveClass(/selected/u);
  await expect(store).not.toHaveClass(/selected/u);
  await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1);
});

test('dragging a multi-selection moves it by one offset and undo restores it', async ({
  page,
}) => {
  await openPlaceholder(page);
  const [actor, store] = placeholderNodes(page);
  const flow = lineOf(page, /^Records, flow/u);
  await page.keyboard.press('ControlOrMeta+a');
  const actorBefore = await boxOf(actor);
  const storeBefore = await boxOf(store);
  const flowBefore = await drawnBy(flow);

  await dragBy(page, actor, 60);

  await expect.poll(async () => (await boxOf(actor)).x).not.toBe(actorBefore.x);
  const actorAfter = await boxOf(actor);
  const storeAfter = await boxOf(store);
  expect(actorAfter.x - actorBefore.x).toBe(storeAfter.x - storeBefore.x);
  expect(actorAfter.y - actorBefore.y).toBe(storeAfter.y - storeBefore.y);
  expect(await drawnBy(flow)).not.toBe(flowBefore);
  await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1);

  await runFromMenu(page, 'Undo');

  expect(await boxOf(actor)).toEqual(actorBefore);
  expect(await boxOf(store)).toEqual(storeBefore);
  expect(await drawnBy(flow)).toBe(flowBefore);
});

test('a selected free flow moves by the group offset and undo restores it', async ({
  page,
}) => {
  await openEcluse(page);
  const pilot = await selectNode(page, /^Écluse Pilot/u);
  const probe = nodeNamed(page, /^OSV Dataset for Supported Registries, flow/u);
  const line = lineOf(page, /^OSV Dataset for Supported Registries, flow/u);
  await probe.focus();
  await page.keyboard.press('Shift+Enter');
  await expect(probe).toHaveClass(/selected/u);
  await canvasSettled(page);
  const pilotBefore = await pilot.boundingBox();
  const lineBefore = await line.boundingBox();
  const drawnBefore = await drawnBy(line);
  expect(pilotBefore).not.toBeNull();
  expect(lineBefore).not.toBeNull();

  await dragBy(page, pilot, 60);

  await expect.poll(async () => (await boxOf(pilot)).x).not.toBe(920);
  const pilotAfter = await pilot.boundingBox();
  const lineAfter = await line.boundingBox();
  expect(pilotAfter).not.toBeNull();
  expect(lineAfter).not.toBeNull();
  expect((lineAfter?.width ?? 0) - (lineBefore?.width ?? 0)).toBeCloseTo(0);
  expect((lineAfter?.height ?? 0) - (lineBefore?.height ?? 0)).toBeCloseTo(0);
  expect((lineAfter?.x ?? 0) - (lineBefore?.x ?? 0)).toBeCloseTo(
    (pilotAfter?.x ?? 0) - (pilotBefore?.x ?? 0),
  );
  expect((lineAfter?.y ?? 0) - (lineBefore?.y ?? 0)).toBeCloseTo(
    (pilotAfter?.y ?? 0) - (pilotBefore?.y ?? 0),
  );

  await runFromMenu(page, 'Undo');

  expect(await pilot.boundingBox()).toEqual(pilotBefore);
  expect(await drawnBy(line)).toBe(drawnBefore);
});

test('Delete removes a multi-selection with one cascade announcement', async ({
  page,
}) => {
  await openPlaceholder(page);
  const [actor, store] = placeholderNodes(page);
  await boxSelect(page, [actor, store]);

  await page.keyboard.press('Delete');

  await expect(elementNodes(page)).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await expect(editAnnouncement(page)).toHaveText(
    /Removed 3 elements.*1 threat link dropped/u,
  );
  await expect(editAnnouncement(page).locator('p')).toHaveCount(1);
});
