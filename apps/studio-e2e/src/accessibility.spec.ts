import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

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

test('the open connect listbox carries no violation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await page.getByRole('button', { name: 'New actor' }).click();
  await page.getByRole('combobox', { name: 'Flow to' }).press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();

  await audit(page, 'showing the open connect listbox', '[role="listbox"]');
});
