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

  // The open listbox is audited on its own because Radix hides the rest of
  // the page from assistive technology while it is open, which axe's
  // page-level rules read as a page that has lost its main and its heading.
  await page.getByRole('combobox', { name: 'Severity' }).press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();

  await audit(page, 'showing an open listbox', '[role="listbox"]');
});
