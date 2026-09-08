import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  canvasContainer,
  canvasSettled,
  nodeNamed,
  openPlaceholder,
  runFromMenu,
  savedFile,
  vendored,
} from './studio.fixtures.js';

const sourceText = readFileSync(vendored('test-data/ecluse.json'), 'utf8');
const handleWriteKey = 'saerskrivenRecoveryTestHandleWrite';

test('reload restores the last completed edit', async ({ page }) => {
  await page.addInitScript(
    ({ handleWriteKey: recoveryHandleWriteKey, sourceText: openedText }) => {
      Object.defineProperty(globalThis, 'showOpenFilePicker', {
        value: () =>
          Promise.resolve([
            {
              name: 'ecluse.json',
              getFile: () =>
                Promise.resolve(new File([openedText], 'ecluse.json')),
              createWritable: () =>
                Promise.resolve({
                  write: () => {
                    localStorage.setItem(recoveryHandleWriteKey, 'written');
                  },
                  close: () => undefined,
                }),
            },
          ]),
      });
    },
    { handleWriteKey, sourceText },
  );
  await openPlaceholder(page);
  await runFromMenu(page, 'Open');
  await expect(nodeNamed(page, /^Écluse proxy, process/u)).toBeVisible();
  await canvasSettled(page);

  await nodeNamed(page, /^Écluse proxy, process/u).dblclick();
  const name = page.getByRole('textbox', { name: 'Name of Écluse proxy' });
  await name.fill('Recovered proxy');
  await name.press('Enter');

  await page.reload();
  await expect(canvasContainer(page)).toBeVisible();
  await canvasSettled(page);

  await expect(nodeNamed(page, /^Recovered proxy, process/u)).toHaveCount(1);

  const written = await savedFile(page);
  expect(written.name).toBe('ecluse.json');
  expect(sourceText).toContain('"containedElements"');
  expect(written.text).toContain('"containedElements"');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), handleWriteKey),
  ).toBeNull();
});
