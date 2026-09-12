import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Box } from './canvas-geometry.fixtures.js';
import { registeredChords } from './chords.js';
import {
  cardControlsClear,
  centreOf,
  chromeCard,
  closeMenu,
  diagramChoice,
  diagramSwitcher,
  diagramTitleField,
  exportedFile,
  menuItem,
  nodeNamed,
  openFile,
  openMenu,
  openModel,
  openPlaceholder,
  openSwitcher,
  saerskrivenDiagrams,
  saerskrivenModel,
  screenBoxOf,
  selectByKeyboard,
  threatPanel,
  withoutPickers,
} from './studio.fixtures.js';

const { first, second } = saerskrivenDiagrams;

const below = async (target: Locator, card: Box): Promise<void> => {
  const box = await screenBoxOf(target);
  expect(box.y).toBeGreaterThanOrEqual(card.y + card.height);
};

test('the card holds the chrome, and the switcher still switches diagrams', async ({
  page,
}) => {
  await openModel(page, saerskrivenModel);

  const card = await screenBoxOf(chromeCard(page));
  const viewport = page.viewportSize();
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(viewport?.width ?? 0);
  await cardControlsClear(page);
  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    `Diagram: ${first.title}`,
  );

  await openSwitcher(page);
  await diagramChoice(page, second.title).click();

  await expect(nodeNamed(page, second.drawn)).toHaveCount(1);
  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    `Diagram: ${second.title}`,
  );
});

test('the rename field opens in the title place and the card keeps its width', async ({
  page,
}) => {
  await openModel(page, saerskrivenModel);
  const before = await screenBoxOf(chromeCard(page));
  const title = await screenBoxOf(diagramSwitcher(page));

  await openSwitcher(page);
  await menuItem(page, 'Rename diagram').click();

  const field = await screenBoxOf(diagramTitleField(page));
  expect(field.x).toBeCloseTo(title.x, 0);
  expect(field.y).toBeCloseTo(title.y, 0);
  const after = await screenBoxOf(chromeCard(page));
  expect(after.width).toBeCloseTo(before.width, 0);
});

test('a selection leaves the card uncovered', async ({ page }) => {
  await openPlaceholder(page);

  await selectByKeyboard(page, /^Actor, actor/u);
  await page.keyboard.press(registeredChords['edit-geometry'][0]);

  const card = await screenBoxOf(chromeCard(page));
  await below(page.getByRole('region', { name: 'Position and size' }), card);
  await below(threatPanel(page), card);
  await cardControlsClear(page);
});

test('a refused read and a loss report hang under the card', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openPlaceholder(page);
  const card = await screenBoxOf(chromeCard(page));
  const viewport = page.viewportSize();

  await page.getByTestId('file-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('no threat model here'),
  });

  const notice = page.getByTestId('failure-notice');
  await expect(notice).toContainText('notes.txt');
  await below(notice, card);
  const drawn = await screenBoxOf(notice);
  expect(drawn.x).toBeGreaterThanOrEqual(0);
  expect(drawn.x + drawn.width).toBeLessThanOrEqual(viewport?.width ?? 0);

  await openMenu(page);
  await menuItem(page, 'Save as').click();
  await Promise.all([
    page.waitForEvent('download'),
    menuItem(page, 'Save as Threat Dragon JSON').click(),
  ]);

  const report = page.getByTestId('loss-report');
  await expect(report).not.toBeEmpty();
  await below(report, card);
  await cardControlsClear(page);
});

const opensWhole = async (
  page: Page,
  name: string | RegExp,
): Promise<{ readonly row: Box; readonly drawn: Box }> => {
  const card = await screenBoxOf(chromeCard(page));
  const viewport = page.viewportSize();
  const trigger = page.getByRole('menuitem', { name });
  await trigger.click();
  const submenu = page.getByRole('menu', { name });
  await expect(submenu).toBeVisible();

  const row = await screenBoxOf(trigger);
  const drawn = await screenBoxOf(submenu);
  const top = Math.round(drawn.y);
  const bottom = Math.round(drawn.y + drawn.height);
  expect(Math.round(drawn.x - card.x)).toBeGreaterThanOrEqual(0);
  expect(Math.round(drawn.x - card.x)).toBeLessThanOrEqual(1);
  expect(Math.round(drawn.x + drawn.width)).toBeLessThanOrEqual(
    viewport?.width ?? 0,
  );
  expect(top).toBeGreaterThanOrEqual(0);
  expect(bottom).toBeLessThanOrEqual(viewport?.height ?? 0);
  expect(
    top >= Math.round(row.y + row.height) || bottom <= Math.round(row.y),
  ).toBe(true);
  expect(
    await submenu.evaluate(
      (element) => element.scrollHeight <= element.clientHeight,
    ),
  ).toBe(true);
  return { row, drawn };
};

test('every submenu opens whole at the card edge, and an export downloads from one', async ({
  page,
}) => {
  await openFile(page, 'test-data/ecluse.json');

  for (const name of ['Export', 'Arrange', /^Appearance /u]) {
    await openMenu(page);
    await opensWhole(page, name);
    await closeMenu(page);
  }

  const output = await exportedFile(page, 'Diagram as SVG');
  expect(output.name).toBe('ecluse.svg');
  expect(output.bytes.length).toBeGreaterThan(0);
});

test('a submenu with no room under its row opens whole over it', async ({
  page,
}) => {
  const width = page.viewportSize()?.width ?? 0;
  await page.setViewportSize({ width, height: 480 });
  await openFile(page, 'test-data/ecluse.json');
  await openMenu(page);
  await menuItem(page, 'Arrange').evaluate((element) => {
    element.scrollIntoView({ block: 'end' });
  });

  const { row, drawn } = await opensWhole(page, 'Arrange');

  expect(Math.round(drawn.y + drawn.height)).toBeLessThanOrEqual(
    Math.round(row.y),
  );
});

test('a pointer heading down and left from Export into its submenu reaches an export', async ({
  page,
}) => {
  await openFile(page, 'test-data/ecluse.json');
  await openMenu(page);
  const start = await centreOf(menuItem(page, 'Export'));
  await page.mouse.move(start.x - 60, start.y);
  await page.mouse.move(start.x, start.y, { steps: 5 });
  const svg = menuItem(page, 'Diagram as SVG');
  await expect(svg).toBeVisible();

  const target = await centreOf(svg);
  expect(target.x).toBeLessThan(start.x);
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await expect(page.getByRole('menu', { name: 'Export' })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.mouse.click(target.x, target.y),
  ]);
  expect(download.suggestedFilename()).toBe('ecluse.svg');
});
