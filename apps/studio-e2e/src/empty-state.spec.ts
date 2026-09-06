import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  elementNodes,
  nodeNamed,
  openPlaceholder,
  savedFile,
  withoutPickers,
} from './studio.fixtures.js';

type DrawnBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

const nowhere: DrawnBox = { x: 0, y: 0, width: 0, height: 0 };

const drawnNames = [
  { of: /^Actor, actor/u, className: 'pn-label', says: 'Actor' },
  { of: /^Store, store/u, className: 'pn-label', says: 'Store' },
  { of: /^Records, flow/u, className: 'pn-flow-label', says: 'Records' },
] as const;

const hint = (page: Page): Locator => page.getByTestId('empty-state-hint');

const boxOf = async (locator: Locator, called: string): Promise<DrawnBox> => {
  const measured = await locator.boundingBox();
  expect(measured, `${called} is on the page`).not.toBeNull();
  return measured ?? nowhere;
};

const overlap = (one: DrawnBox, other: DrawnBox): boolean =>
  one.x < other.x + other.width &&
  other.x < one.x + one.width &&
  one.y < other.y + other.height &&
  other.y < one.y + one.height;

test('the studio opens on an actor, the records it sends, and the store they land in', async ({
  page,
}) => {
  await openPlaceholder(page);

  await expect(elementNodes(page)).toHaveCount(2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  for (const { of, className, says } of drawnNames) {
    const lines = nodeNamed(page, of).locator(`text.${className} tspan`);

    await expect(lines, `${says} is drawn on one line`).toHaveCount(1);
    await expect(lines).toHaveText(says);
  }
});

test('the chrome floating over the canvas covers no part of the diagram', async ({
  page,
}) => {
  await openPlaceholder(page);
  const floating = [
    { locator: hint(page), called: 'the hint' },
    {
      locator: page.getByRole('region', { name: 'Zoom and fit' }),
      called: 'the zoom cluster',
    },
  ];
  const drawn = [
    { locator: nodeNamed(page, /^Actor, actor/u), called: 'the actor' },
    { locator: nodeNamed(page, /^Store, store/u), called: 'the store' },
  ];

  for (const over of floating) {
    for (const under of drawn) {
      expect(
        overlap(
          await boxOf(over.locator, over.called),
          await boxOf(under.locator, under.called),
        ),
        `${over.called} covers ${under.called}`,
      ).toBe(false);
    }
  }
});

test('the empty state says what to do next, and the line goes at the first edit', async ({
  page,
}) => {
  await openPlaceholder(page);

  await expect(hint(page)).toHaveText('Open a model, or pick a tool');

  await page.getByRole('button', { name: 'New actor', exact: true }).click();

  await expect(hint(page)).toHaveCount(0);
});

test('the tab says Untitled until the model lives in a file', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openPlaceholder(page);

  await expect(page).toHaveTitle('Untitled - Saerskriven');

  const written = await savedFile(page);

  expect(written.name).toBe('threat-model.yaml');
  await expect(page).toHaveTitle('threat-model.yaml - Saerskriven');
});
