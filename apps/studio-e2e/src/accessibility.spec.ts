import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { registeredChords } from './chords.js';
import { menuItem, openMenu, withoutPickers } from './studio.fixtures.js';

const audit = async (
  page: Page,
  state: string,
  within?: string,
): Promise<void> => {
  const builder = new AxeBuilder({ page });
  const { violations, incomplete } = await (
    within === undefined ? builder : builder.include(within)
  ).analyze();
  const report = violations
    .map(
      (violation) =>
        `${violation.id} [${violation.impact ?? 'unrated'}] ${violation.nodes
          .map((node) => node.target.join(' '))
          .join(', ')}`,
    )
    .join('\n');
  const undecided = incomplete.map((result) => result.id).join(', ');

  expect(
    violations.map((violation) => violation.id),
    `axe-core reported, with the studio ${state}:\n${report}\nnot gated, axe could not settle: ${undecided || 'nothing'}`,
  ).toEqual([]);
};

test('the studio page carries no axe-core accessibility violation', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await audit(page, 'at rest');
});

// Both colour schemes are audited, because the tokens the properties resolve
// to are what a contrast rule reads and the dark table is a second set of
// them. The state is the page at rest: the states below reach further into
// the studio and do so in whichever scheme the browser is asked for by
// default, which is the light one.
test('the studio carries no violation under the system dark preference', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await audit(page, 'at rest in the dark scheme');
});

// The panel is bound to the selection and holds no editable control without
// one, so the audit of its fields needs an element selected and a threat
// expanded. It is the studio's densest form: every composed control at once,
// inside the panel's own landmark.
test('the studio carries no violation with the threat panel open on a selected element', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await page.getByRole('group', { name: /^Reader, actor/u }).click();
  await page.getByRole('button', { name: /A reader edits/u }).click();
  await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();

  await audit(page, 'showing the threat panel');

  // The open listbox is audited on its own because Radix hides the rest of
  // the page from assistive technology while it is open, which axe's
  // page-level rules read as a page that has lost its main and its heading.
  await page.getByRole('combobox', { name: 'Severity' }).press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();

  await audit(page, 'showing an open listbox', '[role="listbox"]');
});

// A drag is a state of its own: React Flow marks the node and the pane while
// the pointer is down, and the panel stays open over it, which is the densest
// the page gets. The audit runs mid-gesture, before the pointer is lifted.
test('the studio carries no violation with the panel open mid-drag', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  const reader = page.getByRole('group', { name: /^Reader, actor/u });
  await reader.click();
  await expect(page.getByRole('region', { name: 'Threats' })).toBeVisible();

  const box = await reader.boundingBox();
  const from = {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 40, from.y + 30, { steps: 8 });

  await audit(page, 'mid-drag with the threat panel open');

  await page.mouse.up();
});

// The two notice regions hold nothing at rest, so the audit above sees them
// empty. This one gives one of them something to say. Nothing is hidden while
// it does, so the audit stays page-wide rather than being scoped to the
// region: a refusal that broke the page around it would show up here too.
test('the studio carries no violation while it shows a refusal', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await expect(page.getByTestId('failure-notice')).toHaveCSS(
    'display',
    'block',
  );

  await page.getByTestId('file-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('no threat model here'),
  });
  await expect(page.getByTestId('failure-notice')).toContainText(
    'No format claimed notes.txt.',
  );

  await audit(page, 'showing a refusal');
});

// The palette is on the page at rest, so the audit above covers its controls
// as it covers the rest. What it cannot see there is either notice region
// with something in it, or a listbox that is disabled until an element is
// selected, which is what the two tests below reach.
test('the studio carries no violation while it says what an edit did', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await page.getByRole('button', { name: 'New actor' }).click();
  await expect(page.getByTestId('canvas-announcement')).toHaveText(
    'Added New actor, actor.',
  );

  await audit(page, 'showing an added element');

  await page.keyboard.press('Delete');
  await expect(page.getByTestId('canvas-announcement')).toContainText(
    'Removed New actor',
  );

  await audit(page, 'showing a removed element');
});

// The menu is the studio's one command surface, and it is not modal: the
// canvas stays in the accessibility tree behind it, so the audit stays
// page-wide. The report region beside it holds nothing until a file crossing
// costs something, which the save below is what gives it.
test('the studio carries no violation with the menu open', async ({ page }) => {
  await page.addInitScript(withoutPickers);
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await openMenu(page);

  await audit(page, 'showing the open menu');

  await Promise.all([
    page.waitForEvent('download'),
    menuItem(page, 'Save as Threat Dragon JSON').click(),
  ]);
  await expect(page.getByTestId('loss-report')).not.toBeEmpty();

  await audit(page, 'showing a loss report');

  await page.getByRole('button', { name: 'New actor', exact: true }).click();
  await page.keyboard.press(registeredChords['close-file'][0]);
  await expect(menuItem(page, 'Discard the changes and close')).toBeVisible();

  await audit(page, 'showing the menu asking before it closes a file');
});

test('the open connect listbox carries no violation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await page.getByRole('button', { name: 'New actor' }).click();
  await page.getByRole('combobox', { name: 'Flow to' }).press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();

  await audit(page, 'showing the open connect listbox', '[role="listbox"]');
});
