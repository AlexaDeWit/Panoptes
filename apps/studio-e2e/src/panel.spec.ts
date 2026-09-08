import { expect, test, type Locator, type Page } from '@playwright/test';
import { darkPalette, lightPalette, rgbColour } from '@saerskriven/canvas';
import { registeredChords } from './chords.js';
import {
  beforeCanvas,
  canvasSettled,
  chooseByKeyboard,
  chooseInPanel,
  editAnnouncement,
  nodeNamed,
  openEcluse,
  openPlaceholder,
  runFromMenu,
  selectByKeyboard,
  selectNode,
  threatPanel,
} from './studio.fixtures.js';

const softHyphen = '\u00ad';

const disclosure = (page: Page, title: string | RegExp): Locator =>
  threatPanel(page).getByRole('button', { name: title });

const badgeTone = (node: Locator): Locator =>
  node.locator('.pn-badge-primary circle');

const titleField = (page: Page): Locator =>
  threatPanel(page).getByRole('textbox', { name: 'Title' });

const boxOf = async (locator: Locator): Promise<Record<string, number>> => {
  const box = await locator.boundingBox();
  expect(box, 'the box is on the page').not.toBeNull();
  const drawn = box ?? { x: 0, y: 0, width: 0, height: 0 };
  return {
    left: drawn.x,
    right: drawn.x + drawn.width,
    top: drawn.y,
    bottom: drawn.y + drawn.height,
    width: drawn.width,
    height: drawn.height,
  };
};

const panAcross = async (page: Page, by: number): Promise<void> => {
  const box = await page.locator('.react-flow__pane').boundingBox();
  const pane = box ?? { x: 0, y: 0, width: 0, height: 0 };
  const from = { x: pane.x + 24, y: pane.y + pane.height / 2 };
  await page.keyboard.down('Space');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + by, from.y, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  await canvasSettled(page);
};

test('the panel opens on the element selected and goes when the selection does', async ({
  page,
}) => {
  await openPlaceholder(page);
  await expect(threatPanel(page)).toHaveCount(0);

  const actor = await selectNode(page, /^Actor, actor/u);

  await expect(
    threatPanel(page).getByRole('heading', { name: 'Threats on Actor' }),
  ).toBeVisible();
  await expect(
    threatPanel(page).locator(':focus'),
    'selecting an element does not move focus into the panel',
  ).toHaveCount(0);

  await page.keyboard.press('Escape');

  await expect(actor).not.toHaveClass(/selected/u);
  await expect(threatPanel(page)).toHaveCount(0);
});

test('T hands the panel the keyboard, and the two Escapes give it back and clear the selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = await selectByKeyboard(page, /^Actor, actor/u);
  const add = threatPanel(page).getByRole('button', { name: 'Add a threat' });
  await expect(actor).toBeFocused();

  await page.keyboard.press(registeredChords['focus-threats'][0]);
  await expect(add).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(threatPanel(page)).toHaveCount(0);
  await expect(actor).toBeFocused();
  await expect(actor).toHaveClass(/selected/u);

  await page.keyboard.press('Escape');

  await expect(actor).not.toHaveClass(/selected/u);
});

test('an element the panel would cover is panned clear of it', async ({
  page,
}) => {
  await openPlaceholder(page);
  const store = nodeNamed(page, /^Store, store/u);
  const covered = await boxOf(store);

  await selectByKeyboard(page, /^Store, store/u);

  const panel = await boxOf(threatPanel(page));
  expect(
    covered.right,
    'the element was drawn where the panel opens, so the pan has something to do',
  ).toBeGreaterThan(panel.left);
  expect((await boxOf(store)).right).toBeLessThanOrEqual(panel.left);
});

test('a node just inside the panel edge is panned clear of it too', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, /^Actor, actor/u);
  await selectNode(page, /^Actor, actor/u);
  const panel = await boxOf(threatPanel(page));
  await page.keyboard.press('Escape');
  await expect(threatPanel(page)).toHaveCount(0);

  const justInside = 10;
  await panAcross(page, panel.left + justInside - (await boxOf(actor)).right);
  const covered = await boxOf(actor);
  expect(
    covered.right,
    'the node ends under the panel, in the strip its padding and border draw',
  ).toBeGreaterThan(panel.left);

  await selectNode(page, /^Actor, actor/u);

  expect((await boxOf(actor)).right).toBeLessThanOrEqual(panel.left);
});

test('a draft the model refused comes back when its element is selected again', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectNode(page, /^Actor, actor/u);
  await threatPanel(page).getByRole('button', { name: 'Add a threat' }).click();
  await titleField(page).fill(`Soft${softHyphen}hyphen`);
  await titleField(page).press('Enter');
  await expect(titleField(page)).toHaveAttribute('aria-invalid', 'true');

  await selectByKeyboard(page, /^Store, store/u);
  await expect(titleField(page)).toHaveCount(0);
  await selectByKeyboard(page, /^Actor, actor/u);

  await expect(titleField(page)).toHaveValue(`Soft${softHyphen}hyphen`);
  await expect(titleField(page)).toHaveAttribute('aria-invalid', 'true');
});

test('a threat added in the panel reaches the canvas as a badge, and its severity colours it', async ({
  page,
}) => {
  await openEcluse(page);
  const worker = await selectNode(page, /^Mirror worker, process/u);
  await expect(
    page.getByRole('heading', { name: 'Threats on Mirror worker' }),
  ).toBeVisible();

  await threatPanel(page).getByRole('button', { name: 'Add a threat' }).click();

  await expect(
    threatPanel(page).getByRole('textbox', { name: 'Title' }),
  ).toBeFocused();
  await expect(editAnnouncement(page)).toBeEmpty();
  await expect(
    nodeNamed(
      page,
      'Mirror worker, process, 1 open threat, severity not assessed',
    ),
  ).toBeVisible();
  await expect(worker.locator('.pn-badge-mark')).toHaveText('?');
  await expect(badgeTone(worker)).toHaveClass('pn-tone-neutral');

  await chooseInPanel(page, 'Severity', 'critical');

  await expect(
    nodeNamed(
      page,
      'Mirror worker, process, 1 open threat, highest severity critical',
    ),
  ).toBeVisible();
  await expect(worker.locator('.pn-badge-mark')).toHaveText('C');
  await expect(badgeTone(worker)).toHaveClass('pn-tone-critical');
});

test('a status chosen in the panel takes the threat out of the count the canvas draws', async ({
  page,
}) => {
  await openEcluse(page);
  const dredger = await selectNode(page, /^Écluse Dredger, process/u);
  await expect(dredger).toHaveAccessibleName(/5 open threats/u);

  await disclosure(page, /Accidental permanent deletion/u).click();
  await chooseInPanel(page, 'Status', 'mitigated');

  await expect(
    nodeNamed(
      page,
      /^Écluse Dredger, process, 4 open threats, highest severity high/u,
    ),
  ).toBeVisible();
});

test('a threat deleted in the panel leaves the canvas, and undo puts it back', async ({
  page,
}) => {
  await openEcluse(page);
  const dredger = await selectNode(page, /^Écluse Dredger, process/u);
  await expect(dredger).toHaveAccessibleName(/5 open threats/u);

  await disclosure(page, /Massive Purge DoS/u).click();
  await threatPanel(page)
    .getByRole('button', { name: 'Delete threat 21' })
    .click();

  await expect(editAnnouncement(page)).toContainText('21');
  await expect(disclosure(page, /Massive Purge DoS/u)).toHaveCount(0);
  await expect(dredger).toHaveAccessibleName(/4 open threats/u);

  await runFromMenu(page, 'Undo');

  await expect(disclosure(page, /Massive Purge DoS/u)).toHaveCount(1);
  await expect(dredger).toHaveAccessibleName(/5 open threats/u);
});

test('a title edited in the panel is one undo step', async ({ page }) => {
  await openEcluse(page);
  await selectNode(page, /^Écluse Dredger, process/u);
  await disclosure(page, /Massive Purge DoS/u).click();

  const title = threatPanel(page).getByRole('textbox', { name: 'Title' });
  await title.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Massive purge denial of service');
  await title.press('Enter');

  await expect(
    disclosure(page, /Massive purge denial of service/u),
  ).toBeVisible();

  await runFromMenu(page, 'Undo');

  await expect(disclosure(page, /Massive Purge DoS/u)).toBeVisible();
});

test('every field of a threat is reachable and editable from the keyboard, add and delete included', async ({
  page,
}) => {
  await openEcluse(page);
  const worker = await selectNode(page, /^Mirror worker, process/u);
  const add = threatPanel(page).getByRole('button', { name: 'Add a threat' });

  await add.focus();
  await page.keyboard.press('Enter');

  const title = threatPanel(page).getByRole('textbox', { name: 'Title' });
  await expect(title).toBeFocused();
  await title.press('ControlOrMeta+a');
  await page.keyboard.type('Queue poisoning');
  await page.keyboard.press('Tab');

  await expect(
    threatPanel(page).getByRole('combobox', { name: 'Category' }),
  ).toBeFocused();
  await chooseByKeyboard(page, 'ArrowDown');
  await expect(
    threatPanel(page).getByRole('combobox', { name: 'Category' }),
  ).toContainText('STRIDE tampering');

  await page.keyboard.press('Tab');
  await expect(
    threatPanel(page).getByRole('combobox', { name: 'Severity' }),
  ).toBeFocused();
  await chooseByKeyboard(page, 'ArrowUp');
  await expect(
    threatPanel(page).getByRole('combobox', { name: 'Severity' }),
  ).toContainText('critical');

  await page.keyboard.press('Tab');
  await expect(
    threatPanel(page).getByRole('combobox', { name: 'Status' }),
  ).toBeFocused();

  await page.keyboard.press('Tab');
  const description = threatPanel(page).getByRole('textbox', {
    name: 'Description',
  });
  await expect(description).toBeFocused();
  await page.keyboard.type('The queue accepts a job nobody enqueued.');

  await page.keyboard.press('Tab');
  const mitigation = threatPanel(page).getByRole('textbox', {
    name: 'Mitigation',
  });
  await expect(mitigation).toBeFocused();
  await page.keyboard.type('Sign every job.');
  await expect(description).toHaveValue(
    'The queue accepts a job nobody enqueued.',
  );

  await page.keyboard.press('Tab');
  const remove = threatPanel(page).getByRole('button', {
    name: 'Delete threat 103',
  });
  await expect(remove).toBeFocused();

  await expect(disclosure(page, /Queue poisoning/u)).toBeVisible();
  await expect(worker).toHaveAccessibleName(
    /1 open threat, highest severity critical/u,
  );

  await runFromMenu(page, 'Undo');
  await expect(mitigation).toHaveValue('');
  await expect(description).toHaveValue(
    'The queue accepts a job nobody enqueued.',
  );
  await runFromMenu(page, 'Undo');
  await expect(description).toHaveValue('');

  await remove.focus();
  await page.keyboard.press('Enter');

  await expect(add).toBeFocused();
  await expect(worker).toHaveAccessibleName('Mirror worker, process');
});

test('a flow selected on the canvas opens its own threats in the panel', async ({
  page,
}) => {
  await openEcluse(page);

  await beforeCanvas(page).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');

  await expect(
    threatPanel(page).getByRole('heading', { name: /^Threats on npm read/u }),
  ).toBeVisible();
  await expect(disclosure(page, /Massive Purge DoS/u)).toHaveCount(0);
  await expect(disclosure(page, /Package-name typosquatting/u)).toBeVisible();
});

test('collapsed summaries expose severity and status without an empty content strip', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectNode(page, /^Actor, actor/u);
  const panel = threatPanel(page);
  await panel.getByRole('button', { name: 'Add a threat' }).click();
  const summary = disclosure(page, /New threat/u);
  await expect(summary).toHaveAccessibleName(
    /Severity: undecided.*Status: open/u,
  );
  await chooseInPanel(page, 'Severity', 'high');
  const contentId = await summary.getAttribute('aria-controls');
  await summary.click();
  const content = page.locator(`[id="${contentId ?? ''}"]`);
  await expect(content).toBeHidden();
  expect(
    await content.evaluate((node) => node.getBoundingClientRect().height),
  ).toBe(0);
  expect(await content.locator('input, textarea, button').count()).toBe(0);
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
  await expect(summary).toHaveAccessibleName(/Severity: high.*Status: open/u);
  for (const mode of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: mode });
    await expect(summary.locator('circle')).toHaveCSS(
      'fill',
      rgbColour((mode === 'dark' ? darkPalette : lightPalette).toneHigh),
    );
  }
  await page.screenshot({ path: test.info().outputPath('dark-pane.png') });
  await page.emulateMedia({ forcedColors: 'active' });
  await summary.focus();
  await page.keyboard.press('Enter');
  await chooseInPanel(page, 'Status', 'mitigated');
  await summary.click();
  await expect(summary).toHaveAccessibleName(
    /Severity: high.*Status: mitigated/u,
  );
  await expect(nodeNamed(page, /^Actor, actor/u)).toHaveAccessibleName(
    /1 open threat, highest severity medium/u,
  );
  await page.keyboard.press('Tab');
  expect(
    await panel
      .locator('input:focus, textarea:focus, [role="combobox"]:focus')
      .count(),
  ).toBe(0);
});

test('keyboard width changes pan the selected node and persist across selection and close', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPlaceholder(page);
  const actor = await selectByKeyboard(page, /^Actor, actor/u);
  const panel = threatPanel(page);
  const normal = await boxOf(panel);
  expect(normal.width).toBeGreaterThan(346);
  await panAcross(page, normal.left - 10 - (await boxOf(actor)).right);
  const before = await boxOf(actor);
  await panel.getByRole('button', { name: 'Widen pane' }).focus();
  await page.keyboard.press('Enter');
  await canvasSettled(page);
  const wide = await boxOf(panel);
  expect(wide.width).toBeGreaterThan(normal.width);
  expect(before.right).toBeGreaterThan(wide.left);
  await expect
    .poll(async () => (await boxOf(actor)).right)
    .toBeLessThanOrEqual(wide.left);
  await selectByKeyboard(page, /^Store, store/u);
  expect((await boxOf(panel)).width).toBe(wide.width);
  await expect
    .poll(async () => (await boxOf(nodeNamed(page, /^Store, store/u))).right)
    .toBeLessThanOrEqual(wide.left);
  await panel.getByRole('button', { name: 'Close threats' }).focus();
  await page.keyboard.press('Enter');
  await expect(panel).toHaveCount(0);
  await expect(nodeNamed(page, /^Store, store/u)).toBeFocused();
  await page.keyboard.press(registeredChords['focus-threats'][0]);
  expect((await boxOf(panel)).width).toBe(wide.width);
  await panel.getByRole('button', { name: 'Restore pane width' }).focus();
  await page.keyboard.press('Space');
  expect((await boxOf(panel)).width).toBe(normal.width);
});

test('prose grows to a bound, keeps manual resizing, and commits once through pane controls', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectNode(page, /^Actor, actor/u);
  const panel = threatPanel(page);
  await panel.getByRole('button', { name: 'Add a threat' }).click();
  const description = panel.getByRole('textbox', { name: 'Description' });
  const mitigation = panel.getByRole('textbox', { name: 'Mitigation' });
  const initial = await boxOf(description);
  const lineHeight = await description.evaluate((node) =>
    Number.parseFloat(getComputedStyle(node).lineHeight),
  );
  expect(initial.height).toBeGreaterThanOrEqual(lineHeight * 8);
  expect((await boxOf(mitigation)).height).toBe(initial.height);
  const prose = Array.from(
    { length: 80 },
    (_, index) => `Line ${String(index)} of a long threat description.`,
  ).join('\n');
  await description.fill(prose);
  const grown = await boxOf(description);
  expect(grown.height).toBeGreaterThan(initial.height);
  expect(grown.height).toBeLessThanOrEqual(lineHeight * 25);
  await panel.getByRole('button', { name: 'Widen pane' }).click();
  await expect(description).toHaveValue(prose);
  const heading = await boxOf(panel.getByRole('heading', { level: 2 }));
  await mitigation.scrollIntoViewIfNeeded();
  expect((await boxOf(panel.getByRole('heading', { level: 2 }))).top).toBe(
    heading.top,
  );
  await expect(
    panel.getByRole('button', { name: 'Close threats' }),
  ).toBeVisible();
  await mitigation.scrollIntoViewIfNeeded();
  const manual = await boxOf(mitigation);
  await page.mouse.move(manual.right - 5, manual.bottom - 5);
  await page.mouse.down();
  await page.mouse.move(manual.right - 5, manual.bottom + 40, { steps: 5 });
  await page.mouse.up();
  await expect(mitigation).toHaveCSS('resize', 'vertical');
  expect((await boxOf(mitigation)).height).toBeGreaterThan(manual.height);
  await runFromMenu(page, 'Undo');
  await expect(description).toHaveValue('');
  await runFromMenu(page, 'Redo');
  await expect(description).toHaveValue(prose);
  await description.fill(`Draft${softHyphen}text`);
  await panel.getByRole('button', { name: 'Restore pane width' }).click();
  await expect(description).toHaveAttribute('aria-invalid', 'true');
  await panel.getByRole('button', { name: 'Close threats' }).click();
  await page.keyboard.press(registeredChords['focus-threats'][0]);
  await expect(description).toHaveValue(`Draft${softHyphen}text`);
  await expect(description).toHaveAttribute('aria-invalid', 'true');
});

test('long titles and fields remain usable in a narrow viewport', async ({
  page,
}) => {
  await openEcluse(page);
  await selectByKeyboard(page, /^Écluse Dredger, process/u);
  const panel = threatPanel(page);
  await disclosure(page, /Massive Purge DoS/u).click();
  const desktopSeverity = await boxOf(
    panel.getByRole('combobox', { name: 'Severity' }),
  );
  const desktopStatus = await boxOf(
    panel.getByRole('combobox', { name: 'Status' }),
  );
  expect(desktopStatus.top).toBe(desktopSeverity.top);
  await titleField(page).fill('A long threat title '.repeat(15));
  await titleField(page).press('Enter');
  await page.setViewportSize({ width: 360, height: 640 });
  await panel.getByRole('button', { name: 'Widen pane' }).click();
  const bounds = await boxOf(panel);
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(360);
  expect(
    await panel.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  const severity = await boxOf(
    panel.getByRole('combobox', { name: 'Severity' }),
  );
  const status = await boxOf(panel.getByRole('combobox', { name: 'Status' }));
  expect(status.top).toBeGreaterThan(severity.top);
  const longSummary = disclosure(page, /A long threat title/u);
  await longSummary.scrollIntoViewIfNeeded();
  expect((await boxOf(longSummary)).right).toBeLessThanOrEqual(bounds.right);
  await page.screenshot({ path: test.info().outputPath('narrow-pane.png') });
  await panel.getByRole('button', { name: 'Close threats' }).click();
  await expect(panel).toHaveCount(0);
  await expect(nodeNamed(page, /^Écluse Dredger, process/u)).toBeFocused();
});

test('a long element name leaves the pane heading and editor reachable', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectByKeyboard(page, /^Actor, actor/u);
  await page.keyboard.press('Enter');
  const name = page.getByRole('textbox', { name: 'Name of Actor' });
  await name.fill('A long system component name '.repeat(30));
  await name.press('Enter');
  await page.setViewportSize({ width: 360, height: 640 });
  const panel = threatPanel(page);
  const heading = panel.getByRole('heading', { level: 2 });
  await panel.getByRole('button', { name: 'Widen pane' }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(heading).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(async () => heading.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  await page.keyboard.press('Tab');
  await expect(panel.getByRole('button', { name: 'Widen pane' })).toBeFocused();
  await page.keyboard.press('Enter');
  await panel.getByRole('button', { name: 'Add a threat' }).click();
  await expect(titleField(page)).toBeFocused();
  await titleField(page).fill('A threat under a long element name');
  await titleField(page).press('Enter');
  const description = panel.getByRole('textbox', { name: 'Description' });
  await description.fill('The editor remains reachable.');
  await panel.getByRole('button', { name: 'Close threats' }).click();
  await expect(panel).toHaveCount(0);
  await expect(nodeNamed(page, /^A long system component name/u)).toBeFocused();
  await page.keyboard.press(registeredChords['focus-threats'][0]);
  await disclosure(page, /A threat under a long element name/u).click();
  await expect(description).toHaveValue('The editor remains reachable.');
});
