import { expect, test, type Page } from '@playwright/test';
import { boxOf } from './canvas-geometry.fixtures.js';
import {
  boxSelect,
  dragBy,
  editAnnouncement,
  elementNodes,
  nodeNamed,
  openPlaceholder,
  runFromMenu,
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

test('Shift-click and Shift+Enter extend and trim the selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  const [actor, store] = placeholderNodes(page);

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
});

test('dragging a multi-selection moves it by one offset and undo restores it', async ({
  page,
}) => {
  await openPlaceholder(page);
  const [actor, store] = placeholderNodes(page);
  await boxSelect(page, [actor, store]);
  const actorBefore = await boxOf(actor);
  const storeBefore = await boxOf(store);

  await dragBy(page, actor, 60);

  await expect.poll(async () => (await boxOf(actor)).x).not.toBe(actorBefore.x);
  const actorAfter = await boxOf(actor);
  const storeAfter = await boxOf(store);
  expect(actorAfter.x - actorBefore.x).toBe(storeAfter.x - storeBefore.x);
  expect(actorAfter.y - actorBefore.y).toBe(storeAfter.y - storeBefore.y);

  await runFromMenu(page, 'Undo');

  expect(await boxOf(actor)).toEqual(actorBefore);
  expect(await boxOf(store)).toEqual(storeBefore);
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
