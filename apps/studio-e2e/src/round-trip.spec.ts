import {
  readAnyFormat,
  renderDivergences,
  type DetectedRead,
} from '@panoptes/formats';
import { expect, test } from '@playwright/test';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { differingPaths, identified } from './differing-paths.js';
import {
  chooseInPanel,
  connectTarget,
  dragBy,
  nodeNamed,
  openFile,
  placeOf,
  savedFile,
  selectByKeyboard,
  threatPanel,
  vendored,
} from './studio.fixtures.js';

const fixture = 'test-data/ecluse.json';

const addedTitle = 'Mirror queue accepts a job nobody enqueued';

const readBack = (text: string): DetectedRead => {
  const read = readAnyFormat(text);
  expect(
    Either.isRight(read),
    `no format claimed the written file: ${text.slice(0, 200)}`,
  ).toBe(true);
  return Either.getOrThrow(read);
};

const idNamed = (model: DetectedRead['model'], name: string): string => {
  const element = model.diagrams[0].elements.find((one) => one.name === name);
  expect(element, `${name} is not in the fixture`).toBeDefined();
  return element?.id ?? '';
};

const byIdentity = (model: DetectedRead['model']): unknown => ({
  ...model,
  diagrams: model.diagrams.map((diagram) => ({
    ...diagram,
    elements: identified(diagram.elements),
  })),
  threats: identified(model.threats),
});

test('opens Écluse, edits it on both surfaces, and saves a valid, lossless file that parses to the source with the edits and nothing else', async ({
  page,
}) => {
  await openFile(page, fixture);

  const proxy = await selectByKeyboard(page, /^Écluse proxy, process/u);
  const placed = await placeOf(proxy);
  await dragBy(page, proxy, 60);
  await expect.poll(() => placeOf(proxy)).not.toBe(placed);
  await expect(page.getByTestId('file-state')).toHaveText(
    'ecluse.json, Threat Dragon JSON, unsaved changes',
  );

  await page.getByRole('button', { name: 'New store', exact: true }).click();
  await expect(nodeNamed(page, /^New store, store/u)).toHaveCount(1);

  await connectTarget(page).click();
  await page.getByRole('option', { name: 'Écluse proxy', exact: true }).click();
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(21);

  const worker = await selectByKeyboard(page, /^Mirror worker, process/u);
  await threatPanel(page).getByRole('button', { name: 'Add a threat' }).click();
  const title = threatPanel(page).getByRole('textbox', { name: 'Title' });
  await expect(title).toBeFocused();
  await title.press('ControlOrMeta+a');
  await page.keyboard.type(addedTitle);
  await title.press('Enter');
  await chooseInPanel(page, 'Severity', 'critical');

  await expect(worker).toHaveAccessibleName(
    'Mirror worker, process, 1 open threat, highest severity critical',
  );
  await expect(worker.locator('.pn-badge-mark')).toHaveText('C');

  await page.getByRole('button', { name: 'Undo' }).click();

  await expect(
    threatPanel(page).getByRole('combobox', { name: 'Severity' }),
  ).toContainText('undecided');
  await expect(worker).toHaveAccessibleName(
    'Mirror worker, process, 1 open threat, severity not assessed',
  );
  await expect(worker.locator('.pn-badge-mark')).toHaveText('?');

  const written = await savedFile(page);

  await expect(page.getByTestId('file-state')).toHaveText(
    'ecluse.json, Threat Dragon JSON, no unsaved changes',
  );
  await expect(page.getByTestId('loss-report')).toContainText(
    'the threat high-water mark 28, raised to 103 to cover a number this write issued',
  );

  const source = readFileSync(vendored(fixture), 'utf8');
  const before = readBack(source);
  const after = readBack(written.text);

  expect(written.name).toBe('ecluse.json');
  expect(after.format).toBe('threat-dragon');
  expect(renderDivergences(after.divergences)).toBe('No divergence recorded.');

  const held = before.model.diagrams[0].elements;
  const proxyId = idNamed(before.model, 'Écluse proxy');
  const workerId = idNamed(before.model, 'Mirror worker');
  const cellOf = (id: string): number => held.findIndex((one) => one.id === id);

  expect(
    differingPaths(JSON.parse(source), JSON.parse(written.text)),
    'the parsed documents are compared, never the bytes: the writer serializes the model rather than editing the file, so it owns the key order and writes non-ASCII text as itself where the fixture escapes it',
  ).toStrictEqual([
    `detail.diagrams[0].cells[${cellOf(proxyId)}].position.x`,
    `detail.diagrams[0].cells[${cellOf(proxyId)}].position.y`,
    `detail.diagrams[0].cells[${cellOf(workerId)}].data.threats[0]`,
    `detail.diagrams[0].cells[${held.length}]`,
    `detail.diagrams[0].cells[${held.length + 1}]`,
    'detail.threatTop',
  ]);

  const kept = new Set(held.map((one) => one.id));
  const [store, flow] = after.model.diagrams[0].elements.filter(
    (one) => !kept.has(one.id),
  );
  const [threat] = after.model.threats.filter(
    (one) => one.number > before.model.lastIssuedThreatNumber,
  );

  expect([store, flow]).toMatchObject([
    { kind: 'store', name: 'New store' },
    {
      kind: 'flow',
      name: 'New flow',
      source: { kind: 'attached', element: store?.id },
      target: { kind: 'attached', element: proxyId },
    },
  ]);
  expect(threat).toMatchObject({
    number: 103,
    title: addedTitle,
    severity: 'undecided',
    status: 'open',
    elements: [workerId],
  });

  expect(
    differingPaths(byIdentity(before.model), byIdentity(after.model)),
  ).toStrictEqual([
    `diagrams[0].elements.${proxyId}.position.x`,
    `diagrams[0].elements.${proxyId}.position.y`,
    `diagrams[0].elements.${store?.id ?? ''}`,
    `diagrams[0].elements.${flow?.id ?? ''}`,
    `threats.${threat?.id ?? ''}`,
    'lastIssuedThreatNumber',
  ]);
});
