import { expect, test, type Locator, type Page } from '@playwright/test';
import { registeredChords } from './chords.js';
import { lineOf } from './canvas-geometry.fixtures.js';
import {
  dragOnto,
  nodeNamed,
  openEcluse,
  openPlaceholder,
  runFromMenu,
  selectByKeyboard,
  selectNode,
} from './studio.fixtures.js';

const rename = (page: Page, was: string): Locator =>
  page.getByRole('textbox', { name: `Name of ${was}` });

const drawnName = (element: Locator, run: string): Locator =>
  element.locator(`text.${run}`);

const drawFlow = async (page: Page): Promise<void> => {
  const reader = nodeNamed(page, /^Reader, actor/u);
  await reader.hover();
  await dragOnto(
    page,
    reader.locator('[data-handleid="right"]'),
    nodeNamed(page, /^Studio, process/u).locator('[data-handleid="left"]'),
  );
  await expect(nodeNamed(page, /^New flow, flow/u)).toHaveCount(1);
};

test('a process is renamed by double-clicking it, and undo puts the name back', async ({
  page,
}) => {
  await openPlaceholder(page);
  const studio = nodeNamed(page, /^Studio, process/u);

  await studio.dblclick();
  await rename(page, 'Studio').fill('Workshop');
  await rename(page, 'Studio').press('Enter');

  const renamed = nodeNamed(page, /^Workshop, process/u);
  await expect(renamed).toHaveCount(1);
  await expect(drawnName(renamed, 'pn-label')).toHaveText('Workshop');
  await expect(renamed).toBeFocused();

  await runFromMenu(page, 'Undo');

  await expect(nodeNamed(page, /^Studio, process/u)).toHaveCount(1);
});

test('a process is renamed from the keyboard, on the selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectNode(page, /^Studio, process/u);

  await page.keyboard.press(registeredChords.rename[0]);
  await rename(page, 'Studio').fill('Workshop');
  await rename(page, 'Studio').press('Enter');

  await expect(nodeNamed(page, /^Workshop, process/u)).toHaveCount(1);
});

test('escape leaves the name the model holds', async ({ page }) => {
  await openPlaceholder(page);
  const reader = await selectNode(page, /^Reader, actor/u);

  await page.keyboard.press(registeredChords.rename[0]);
  await rename(page, 'Reader').fill('Auditor');
  await rename(page, 'Reader').press('Escape');

  await expect(rename(page, 'Reader')).toHaveCount(0);
  await expect(nodeNamed(page, /^Reader, actor/u)).toHaveCount(1);
  await expect(reader).toBeFocused();
});

test('a flow is renamed by double-clicking the line it draws', async ({
  page,
}) => {
  await openPlaceholder(page);
  await drawFlow(page);

  // A flow's line is drawn horizontally between these two elements, so its
  // box has no height and Playwright reads it as invisible. The stroke is
  // still what the pointer hits, which is the gesture under test, so the
  // actionability check is skipped rather than the click moved off the line.
  await lineOf(page, /^New flow, flow/u).dblclick({ force: true });
  await rename(page, 'New flow').fill('Opens');
  await rename(page, 'New flow').press('Enter');

  const renamed = nodeNamed(page, /^Opens, flow/u);
  await expect(renamed).toHaveCount(1);
  await expect(drawnName(renamed, 'pn-flow-label')).toHaveText('Opens');
});

test('a flow of a real model is renamed from the keyboard', async ({
  page,
}) => {
  await openEcluse(page);
  await selectByKeyboard(page, /^poll jobs, flow/u);

  await page.keyboard.press(registeredChords.rename[0]);
  await rename(page, 'poll jobs').fill('Polling');
  await rename(page, 'poll jobs').press('Enter');

  const renamed = nodeNamed(page, /^Polling, flow/u);
  await expect(renamed).toHaveCount(1);
  await expect(drawnName(renamed, 'pn-flow-label')).toHaveText('Polling');

  await runFromMenu(page, 'Undo');

  await expect(nodeNamed(page, /^poll jobs, flow/u)).toHaveCount(1);
});
