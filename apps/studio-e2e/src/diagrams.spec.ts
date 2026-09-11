import { readAnyFormat } from '@saerskriven/formats';
import { expect, test } from '@playwright/test';
import { Either } from 'effect';
import { registeredChords } from './chords.js';
import {
  canvasContainer,
  canvasSettled,
  diagramChoice,
  diagramSwitcher,
  diagramTitleField,
  elementNodes,
  menuItem,
  nodeNamed,
  openMenu,
  openModel,
  openPlaceholder,
  openSwitcher,
  placeByClick,
  saerskrivenModel,
  savedFile,
  withoutPickers,
} from './studio.fixtures.js';

const firstTitle = 'Reading a file and rendering it';
const secondTitle = 'Agents and the desktop shell';
const onFirst = /^Codec read, process/u;
const onSecond = /^Agent and its harness, actor/u;

const titlesIn = (text: string): readonly string[] => {
  const read = readAnyFormat(text);
  expect(Either.isRight(read)).toBe(true);
  return Either.getOrThrow(read).model.diagrams.map((diagram) => diagram.title);
};

test('the switcher names the one diagram of the placeholder, and the menu holds no diagram group', async ({
  page,
}) => {
  await openPlaceholder(page);

  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    'Diagram: Untitled diagram',
  );
  await openMenu(page);
  await expect(menuItem(page, 'Next diagram')).toHaveCount(0);
  await expect(page.getByRole('menuitemradio')).toHaveCount(0);
  await page.keyboard.press('Escape');

  await openSwitcher(page);
  await expect(diagramChoice(page, 'Untitled diagram')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(menuItem(page, 'New diagram')).toBeVisible();
  await expect(menuItem(page, 'Rename diagram')).toBeVisible();
});

test('the switcher lists the diagrams by title, and a choice draws the one chosen', async ({
  page,
}) => {
  await openModel(page, saerskrivenModel);
  await expect(nodeNamed(page, onFirst)).toHaveCount(1);
  await expect(nodeNamed(page, onSecond)).toHaveCount(0);
  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    `Diagram: ${firstTitle}`,
  );

  await openSwitcher(page);
  await expect(diagramChoice(page, firstTitle)).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(diagramChoice(page, secondTitle)).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await diagramChoice(page, secondTitle).click();

  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(nodeNamed(page, onSecond)).toHaveCount(1);
  await expect(nodeNamed(page, onFirst)).toHaveCount(0);
  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    `Diagram: ${secondTitle}`,
  );
  await expect(page.getByTestId('canvas-announcement')).toContainText(
    secondTitle,
  );
});

test('the next and previous chords step through the diagrams and wrap', async ({
  page,
}) => {
  await openModel(page, saerskrivenModel);
  const switcher = diagramSwitcher(page);

  await page.keyboard.press(registeredChords['next-diagram'][0]);
  await expect(switcher).toHaveAccessibleName(`Diagram: ${secondTitle}`);
  await expect(nodeNamed(page, onSecond)).toHaveCount(1);

  await page.keyboard.press(registeredChords['next-diagram'][0]);
  await expect(switcher).toHaveAccessibleName(`Diagram: ${firstTitle}`);

  await page.keyboard.press(registeredChords['previous-diagram'][0]);
  await expect(switcher).toHaveAccessibleName(`Diagram: ${secondTitle}`);
});

test('switching clears the selection and adds no history, so undo has nothing to do', async ({
  page,
}) => {
  await openModel(page, saerskrivenModel);
  const process = nodeNamed(page, onFirst);
  await process.click();
  await expect(process).toHaveClass(/selected/u);

  await page.keyboard.press(registeredChords['next-diagram'][0]);
  await expect(nodeNamed(page, onSecond)).toHaveCount(1);
  await page.keyboard.press(registeredChords.undo[0]);

  await expect(nodeNamed(page, onSecond)).toHaveCount(1);
  await openMenu(page);
  await expect(menuItem(page, 'Undo')).toHaveAttribute('data-disabled', '');
  await page.keyboard.press('Escape');
  await page.keyboard.press(registeredChords['previous-diagram'][0]);
  await expect(process).toHaveCount(1);
  await expect(process).not.toHaveClass(/selected/u);
});

test('a new diagram is named as it is made, drawn empty, and saved with its title', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openPlaceholder(page);
  await expect(elementNodes(page)).toHaveCount(2);

  await openSwitcher(page);
  await menuItem(page, 'New diagram').click();

  const field = diagramTitleField(page);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('Untitled diagram');
  await page.keyboard.type('Request forgery');
  await page.keyboard.press('Enter');

  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    'Diagram: Request forgery',
  );
  await expect(elementNodes(page)).toHaveCount(0);
  await placeByClick(page, 'Actor', /^New actor, actor/u);
  await page.keyboard.press('Enter');

  const written = await savedFile(page);
  expect(titlesIn(written.text)).toEqual([
    'Untitled diagram',
    'Request forgery',
  ]);

  await page.keyboard.press(registeredChords['previous-diagram'][0]);
  await expect(elementNodes(page)).toHaveCount(2);
});

test('a diagram is renamed in place, Escape keeps the old title, and undo takes the new one back', async ({
  page,
}) => {
  await openModel(page, saerskrivenModel);

  await openSwitcher(page);
  await menuItem(page, 'Rename diagram').click();
  await expect(diagramTitleField(page)).toBeFocused();
  await page.keyboard.type('Abandoned');
  await page.keyboard.press('Escape');
  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    `Diagram: ${firstTitle}`,
  );
  await expect(diagramSwitcher(page)).toBeFocused();

  await openSwitcher(page);
  await menuItem(page, 'Rename diagram').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  await expect(diagramTitleField(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(
    page.getByText('A name cannot be empty.', { exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  await openSwitcher(page);
  await menuItem(page, 'Rename diagram').click();
  await page.keyboard.type('Reading and rendering');
  await page.keyboard.press('Enter');
  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    'Diagram: Reading and rendering',
  );
  await expect(diagramSwitcher(page)).toBeFocused();
  await openSwitcher(page);
  await expect(diagramChoice(page, 'Reading and rendering')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.keyboard.press('Escape');

  await page.keyboard.press(registeredChords.undo[0]);
  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    `Diagram: ${firstTitle}`,
  );
});

test('an edit lands on the diagram on screen, the saved file holds it there, and a reload comes back to that diagram', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openModel(page, saerskrivenModel);
  await page.keyboard.press(registeredChords['next-diagram'][0]);
  await expect(nodeNamed(page, onSecond)).toHaveCount(1);
  await canvasSettled(page);

  await placeByClick(page, 'Actor', /^New actor, actor/u);
  await page.keyboard.press('Enter');

  const written = await savedFile(page);
  const read = readAnyFormat(written.text);
  expect(Either.isRight(read)).toBe(true);
  const model = Either.getOrThrow(read).model;
  const named = (id: string): readonly string[] =>
    model.diagrams
      .find((diagram) => diagram.id === id)
      ?.elements.map((element) => element.name) ?? [];
  expect(named('agent-and-desktop')).toContain('New actor');
  expect(named('read-and-render')).not.toContain('New actor');

  await page.reload();
  await expect(canvasContainer(page)).toBeVisible();
  await canvasSettled(page);

  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    `Diagram: ${secondTitle}`,
  );
  await expect(nodeNamed(page, /^New actor, actor/u)).toHaveCount(1);
});
