import {
  darkPalette,
  lightPalette,
  type Colour,
  type Palette,
} from '@panoptes/canvas';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { nodeNamed, openEcluse } from './studio.fixtures.js';

/** A token as a browser reports it back out of a computed style. */
const rendered = (colour: Colour): string => {
  const [red, green, blue] = [1, 3, 5].map((at) =>
    parseInt(colour.slice(at, at + 2), 16),
  );
  return `rgb(${red}, ${green}, ${blue})`;
};

/** What the diagram is drawn on, which the studio's own CSS module colours. */
const ground = (page: Page): Locator => page.getByTestId('canvas-container');

/**
 * One element's outline, which the canvas package's stylesheet colours. It is
 * a process, whose glyph is a single shape, so the locator resolves to one
 * element where a store's pair of lines would give two.
 */
const outline = (page: Page): Locator =>
  nodeNamed(page, /^Écluse proxy, process/u).locator('.pn-shape');

/**
 * The chrome and the diagram are read together because they are coloured by
 * two different sheets: the CSS module reads the custom properties the app
 * root declares, and the canvas sheet the studio injects reads the same ones.
 */
const drawnFrom = async (page: Page, palette: Palette): Promise<void> => {
  await expect(ground(page)).toHaveCSS(
    'background-color',
    rendered(palette.surfaceCanvas),
  );
  await expect(outline(page)).toHaveCSS(
    'stroke',
    rendered(palette.textPrimary),
  );
};

test('the studio takes the dark table when the scheme changes under it', async ({
  page,
}) => {
  await openEcluse(page);
  await drawnFrom(page, lightPalette);

  await page.emulateMedia({ colorScheme: 'dark' });

  await drawnFrom(page, darkPalette);
});

test('a studio opened under the dark preference draws from that table', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openEcluse(page);

  await drawnFrom(page, darkPalette);
});
