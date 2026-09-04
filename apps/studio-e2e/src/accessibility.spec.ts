import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const audit = async (
  page: Page,
  state: string,
  within?: string,
): Promise<void> => {
  const builder = new AxeBuilder({ page });
  const { violations } = await (
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

  expect(
    violations.map((violation) => violation.id),
    `axe-core reported, with the studio ${state}:\n${report}`,
  ).toEqual([]);
};

test('the studio page carries no axe-core accessibility violation', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await audit(page, 'at rest');

  // The open listbox is audited on its own. Radix hides the rest of the page
  // from assistive technology while a listbox is open (`aria-hidden` on every
  // element outside it), which is the behaviour a listbox should have and
  // which axe's page-level rules, landmark-one-main and page-has-heading-one
  // among them, read as a page that has lost its main and its heading. Every
  // rule still applies to the overlay itself, contrast and roles included,
  // and the control portals its content inside the panel's landmark so the
  // region rule holds there too.
  await page.getByRole('combobox', { name: 'Severity' }).press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();

  await audit(page, 'showing an open listbox', '[role="listbox"]');
});
