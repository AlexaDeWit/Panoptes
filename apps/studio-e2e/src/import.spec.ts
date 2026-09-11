import { expect, test } from '@playwright/test';
import { saerskrivenYamlCodec } from '@saerskriven/formats';
import { Either } from 'effect';
import {
  dragOnto,
  handleOn,
  nodeNamed,
  menuButton,
  openMenu,
  openPlaceholder,
  runFromMenu,
  savedFile,
  vendored,
  withoutPickers,
} from './studio.fixtures.js';

test('imports beside Export, draws the converted model, and saves native YAML', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openPlaceholder(page);
  await openMenu(page);
  const entries = await page.getByRole('menuitem').allTextContents();
  expect(entries.findIndex((entry) => entry.startsWith('Import')) + 1).toBe(
    entries.findIndex((entry) => entry.startsWith('Export')),
  );
  const chooser = page.waitForEvent('filechooser');
  await runFromMenu(page, 'Import');
  await (await chooser).setFiles(vendored('test-data/otm/example.json'));
  await expect(page.getByTestId('failure-notice')).toBeEmpty();
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await expect(menuButton(page)).toHaveAccessibleName('Menu, unsaved changes');
  const source = nodeNamed(page, /^Class CustomerDatabase, process/u);
  const target = nodeNamed(page, /^Customer Database, process/u);
  await source.hover();
  await dragOnto(page, handleOn(source, 'left'), handleOn(target, 'right'));
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);
  const output = await savedFile(page);
  expect(output.name).toBe('example.yaml');
  const read = Either.getOrThrow(saerskrivenYamlCodec.read(output.text));
  expect(read.model.threats).toHaveLength(2);
  await expect(menuButton(page)).toHaveAccessibleName('Menu');
});
