import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readAnyFormat } from '@saerskriven/formats';
import { Either } from 'effect';
import {
  canvasSettled,
  chooseByKeyboard,
  chooseInPanel,
  openFile,
  savedFile,
  selectByKeyboard,
  threatPanel,
} from './studio.fixtures.js';

const fixture = 'threat-modelling/saerskriven.yaml';

async function properties(page: Page, name: RegExp) {
  await selectByKeyboard(page, name);
  await threatPanel(page)
    .getByRole('button', { name: 'Security properties' })
    .click();
}

test('edits every element kind and preserves security facts through save, undo, redo and reload', async ({
  page,
}) => {
  test.setTimeout(60_000);
  test.info().annotations.push({
    type: 'timeout',
    description:
      'This scenario commits all 16 properties across five element kinds, then saves and reloads.',
  });
  await openFile(page, fixture);
  await properties(page, /^Model author or upstream tool, actor/u);
  const authentication = threatPanel(page).getByRole('combobox', {
    name: 'Provides authentication',
  });
  await expect(authentication).toContainText('Not recorded');
  await authentication.focus();
  await chooseByKeyboard(page, 'ArrowDown');
  await expect(authentication).toContainText('Yes');
  await chooseInPanel(page, 'Provides authentication', 'No');

  await properties(page, /^Codec read, process/u);
  await chooseInPanel(page, 'Handles card payments', 'No');
  await chooseInPanel(page, 'Handles goods or services', 'Yes');
  await chooseInPanel(page, 'Web application', 'No');
  await chooseInPanel(page, 'Privilege level recording', 'Recorded');
  const privilege = threatPanel(page).getByRole('textbox', {
    name: 'Privilege level',
  });
  await privilege.fill('operator');
  await privilege.press('Enter');
  await chooseInPanel(page, 'Privilege level recording', 'Not recorded');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(privilege).toHaveValue('operator');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(privilege).toHaveCount(0);
  await chooseInPanel(page, 'Privilege level recording', 'Recorded');
  await expect(privilege).toHaveValue('');

  await properties(page, /^Threat model file, store/u);
  for (const label of [
    'Log store',
    'Encrypted storage',
    'Signed storage',
    'Stores credentials',
    'Stores inventory',
  ]) {
    await chooseInPanel(page, label, 'No');
  }
  await chooseInPanel(page, 'Encrypted storage', 'Yes');

  await properties(page, /^A text of unknown format, flow/u);
  await chooseInPanel(page, 'Encrypted flow', 'Yes');
  await chooseInPanel(page, 'Public network', 'No');
  await chooseInPanel(page, 'Protocol recording', 'Recorded');
  await threatPanel(page)
    .getByRole('textbox', { name: 'Protocol' })
    .fill('HTTPS');
  await threatPanel(page)
    .getByRole('textbox', { name: 'Protocol' })
    .press('Enter');
  await chooseInPanel(page, 'Crossed trust boundaries recording', 'Recorded');
  await chooseInPanel(page, 'Add to crossed trust boundaries', 'Foreign input');
  await threatPanel(page)
    .getByRole('group', { name: 'Crossed trust boundaries', exact: true })
    .getByRole('button', { name: 'Add relationship' })
    .click();

  await properties(page, /^Foreign input, trust boundary/u);
  await chooseInPanel(page, 'Contained elements recording', 'Recorded');
  await chooseInPanel(page, 'Add to contained elements', 'Threat model file');
  await threatPanel(page)
    .getByRole('group', { name: 'Contained elements', exact: true })
    .getByRole('button', { name: 'Add relationship' })
    .click();
  await chooseInPanel(page, 'Crossing flows recording', 'Recorded');
  await chooseInPanel(
    page,
    'Add to crossing flows',
    'A text of unknown format',
  );
  await threatPanel(page)
    .getByRole('group', { name: 'Crossing flows', exact: true })
    .getByRole('button', { name: 'Add relationship' })
    .click();

  const saved = Either.getOrThrow(
    readAnyFormat((await savedFile(page)).text),
  ).model;
  const elements = saved.diagrams[0].elements;
  expect(elements.find((element) => element.id === 'el-author')).toMatchObject({
    providesAuthentication: false,
  });
  expect(elements.find((element) => element.id === 'el-read')).toMatchObject({
    handlesCardPayment: false,
    handlesGoodsOrServices: true,
    isWebApplication: false,
    privilegeLevel: '',
  });
  expect(
    elements.find((element) => element.id === 'el-model-file'),
  ).toMatchObject({
    isALog: false,
    isEncrypted: true,
    isSigned: false,
    storesCredentials: false,
    storesInventory: false,
  });
  expect(elements.find((element) => element.id === 'fl-open')).toMatchObject({
    protocol: 'HTTPS',
    isEncrypted: true,
    isPublicNetwork: false,
    trustBoundaryIds: ['tb-foreign'],
  });
  expect(elements.find((element) => element.id === 'tb-foreign')).toMatchObject(
    { containedElements: ['el-model-file'], crossingFlows: ['fl-open'] },
  );
  await page.reload();
  await canvasSettled(page);
  await properties(page, /^A text of unknown format, flow/u);
  await expect(
    threatPanel(page).getByRole('textbox', { name: 'Protocol' }),
  ).toHaveValue('HTTPS');
  await expect(
    threatPanel(page).getByRole('combobox', {
      name: 'Crossed trust boundaries 1',
      exact: true,
    }),
  ).toContainText('Foreign input');
});

test('shows recorded and absent states at wide and narrow widths with accessible keyboard controls', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await openFile(page, fixture);
  await properties(page, /^A text of unknown format, flow/u);
  await chooseInPanel(page, 'Encrypted flow', 'No');
  await chooseInPanel(page, 'Protocol recording', 'Recorded');
  await chooseInPanel(page, 'Crossed trust boundaries recording', 'Recorded');
  await chooseInPanel(page, 'Add to crossed trust boundaries', 'Foreign input');
  await threatPanel(page)
    .getByRole('button', { name: 'Add relationship' })
    .click();
  await expect(
    threatPanel(page).getByRole('combobox', { name: 'Public network' }),
  ).toContainText('Not recorded');
  await expect(
    threatPanel(page).getByRole('textbox', { name: 'Protocol' }),
  ).toHaveValue('');
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="threat-panel"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('security-wide.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await properties(page, /^Foreign input, trust boundary/u);
  await chooseInPanel(page, 'Contained elements recording', 'Recorded');
  await expect(
    threatPanel(page).getByRole('combobox', {
      name: 'Crossing flows recording',
    }),
  ).toContainText('Not recorded');
  const target = threatPanel(page).getByRole('combobox', {
    name: 'Add to contained elements',
  });
  await target.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('option', { name: 'Foreign input', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('option', { name: 'Agent and its harness', exact: true }),
  ).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).include('[role="listbox"]').analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(target).toBeFocused();
  const bounds = await threatPanel(page).boundingBox();
  expect(bounds).not.toBeNull();
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
  expect(
    await threatPanel(page).evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('security-narrow.png') });
});

test('deletion and copying update declared relationships through the editor', async ({
  page,
}) => {
  await openFile(page, fixture);
  await properties(page, /^A text of unknown format, flow/u);
  await chooseInPanel(page, 'Crossed trust boundaries recording', 'Recorded');
  await chooseInPanel(page, 'Add to crossed trust boundaries', 'Foreign input');
  await threatPanel(page)
    .getByRole('button', { name: 'Add relationship' })
    .click();
  await properties(page, /^Foreign input, trust boundary/u);
  await chooseInPanel(page, 'Contained elements recording', 'Recorded');
  await chooseInPanel(page, 'Add to contained elements', 'Threat model file');
  await threatPanel(page)
    .getByRole('group', { name: 'Contained elements', exact: true })
    .getByRole('button', { name: 'Add relationship' })
    .click();
  await chooseInPanel(page, 'Crossing flows recording', 'Recorded');
  await chooseInPanel(
    page,
    'Add to crossing flows',
    'A text of unknown format',
  );
  await threatPanel(page)
    .getByRole('group', { name: 'Crossing flows', exact: true })
    .getByRole('button', { name: 'Add relationship' })
    .click();

  await selectByKeyboard(page, /^Threat model file, store/u);
  await page.keyboard.press('Delete');
  await properties(page, /^Foreign input, trust boundary/u);
  const contained = threatPanel(page).getByRole('combobox', {
    name: 'Contained elements 1',
    exact: true,
  });
  await expect(contained).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(contained).toContainText('Threat model file');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(contained).toHaveCount(0);

  const boundary = page.locator('.react-flow__node[data-id="tb-foreign"]');
  await boundary.focus();
  await page.keyboard.press('ControlOrMeta+d');
  const copied = Either.getOrThrow(readAnyFormat((await savedFile(page)).text))
    .model.diagrams[0].elements;
  const boundaries = copied.filter(
    (element) =>
      element.kind === 'trust-boundary' && element.name === 'Foreign input',
  );
  expect(boundaries).toHaveLength(2);
  expect(
    boundaries.find((element) => element.id === 'tb-foreign'),
  ).toMatchObject({ containedElements: [], crossingFlows: ['fl-open'] });
  expect(
    boundaries.find((element) => element.id !== 'tb-foreign'),
  ).toMatchObject({ containedElements: [], crossingFlows: [] });

  await boundary.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Delete');
  const removed = Either.getOrThrow(
    readAnyFormat((await savedFile(page)).text),
  ).model;
  expect(
    removed.diagrams[0].elements.find((element) => element.id === 'fl-open'),
  ).toMatchObject({ trustBoundaryIds: [] });
});
