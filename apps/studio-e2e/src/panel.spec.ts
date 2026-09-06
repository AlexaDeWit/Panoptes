import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  beforeCanvas,
  chooseByKeyboard,
  chooseInPanel,
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
  return { left: drawn.x, right: drawn.x + drawn.width };
};

test('the panel opens on the element selected and goes when the selection does', async ({
  page,
}) => {
  await openPlaceholder(page);
  await expect(threatPanel(page)).toHaveCount(0);

  const reader = await selectNode(page, /^Reader, actor/u);

  await expect(
    threatPanel(page).getByRole('heading', { name: 'Threats on Reader' }),
  ).toBeVisible();
  await expect(
    threatPanel(page).locator(':focus'),
    'selecting an element does not move focus into the panel',
  ).toHaveCount(0);

  await page.keyboard.press('Escape');

  await expect(reader).not.toHaveClass(/selected/u);
  await expect(threatPanel(page)).toHaveCount(0);
});

test('Enter hands the panel the keyboard, and the two Escapes give it back and clear the selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  const reader = await selectByKeyboard(page, /^Reader, actor/u);
  const add = threatPanel(page).getByRole('button', { name: 'Add a threat' });
  await expect(reader).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(add).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(threatPanel(page)).toHaveCount(0);
  await expect(reader).toBeFocused();
  await expect(reader).toHaveClass(/selected/u);

  await page.keyboard.press('Escape');

  await expect(reader).not.toHaveClass(/selected/u);
});

test('an element the panel would cover is panned clear of it', async ({
  page,
}) => {
  await openPlaceholder(page);
  const studio = nodeNamed(page, /^Studio, process/u);
  const covered = await boxOf(studio);

  await selectByKeyboard(page, /^Studio, process/u);

  const panel = await boxOf(threatPanel(page));
  expect(
    covered.right,
    'the element was drawn where the panel opens, so the pan has something to do',
  ).toBeGreaterThan(panel.left);
  expect((await boxOf(studio)).right).toBeLessThanOrEqual(panel.left);
});

test('a draft the model refused comes back when its element is selected again', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectNode(page, /^Reader, actor/u);
  await disclosure(page, /A reader edits/u).click();
  await titleField(page).fill(`Soft${softHyphen}hyphen`);
  await titleField(page).press('Enter');
  await expect(titleField(page)).toHaveAttribute('aria-invalid', 'true');

  await selectByKeyboard(page, /^Studio, process/u);
  await expect(titleField(page)).toHaveCount(0);
  await selectByKeyboard(page, /^Reader, actor/u);

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
  await expect(page.getByTestId('threat-announcement')).toContainText(
    'Threat 103 added.',
  );
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

  await expect(page.getByTestId('threat-announcement')).toContainText(
    'Threat 21 deleted.',
  );
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
