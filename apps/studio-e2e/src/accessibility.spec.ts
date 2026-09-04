import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the studio page carries no axe-core accessibility violation', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  const { violations } = await new AxeBuilder({ page }).analyze();
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
    `axe-core reported:\n${report}`,
  ).toEqual([]);
});
