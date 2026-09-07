import { expect, test } from '@playwright/test';
import {
  nodeNamed,
  openEcluse,
  placeByClick,
  runFromMenu,
  selectNode,
  threatPanel,
} from './studio.fixtures.js';

const retitled = 'Massive purge denial of service';

test('redo puts back an edit undone on the canvas and one undone in the panel', async ({
  page,
}) => {
  await openEcluse(page);

  const added = nodeNamed(page, /^New actor, actor/u);
  await placeByClick(page, 'Actor', /^New actor, actor/u);
  await page.keyboard.press('Enter');

  await runFromMenu(page, 'Undo');
  await expect(added).toHaveCount(0);

  await runFromMenu(page, 'Redo');
  await expect(added).toHaveCount(1);

  await selectNode(page, /^Écluse Dredger, process/u);
  const disclosure = threatPanel(page).getByRole('button', {
    name: /Massive Purge DoS/u,
  });
  await disclosure.click();
  const title = threatPanel(page).getByRole('textbox', { name: 'Title' });
  await title.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(retitled);
  await title.press('Enter');
  await expect(
    threatPanel(page).getByRole('button', { name: retitled }),
  ).toBeVisible();

  await runFromMenu(page, 'Undo');
  await expect(disclosure).toBeVisible();

  await runFromMenu(page, 'Redo');
  await expect(
    threatPanel(page).getByRole('button', { name: retitled }),
  ).toBeVisible();
  await expect(added).toHaveCount(1);
});
