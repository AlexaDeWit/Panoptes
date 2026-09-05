import { expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Where React Flow has the canvas, read off the transform it writes. Zoom and
 * fit are the viewport moving with nothing in the model changing, so the
 * transform is the only thing that says they happened.
 */
export const viewportTransform = async (page: Page): Promise<string> =>
  (await page.locator('.react-flow__viewport').getAttribute('style')) ?? '';

/** The file a chord asked the browser to download, and what it holds. */
export type SavedByKey = {
  readonly name: string;
  readonly text: string;
};

/** Presses `chord` and reads back the file the studio wrote through it. */
export const savedByKey = async (
  page: Page,
  chord: string,
): Promise<SavedByKey> => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.keyboard.press(chord),
  ]);
  return {
    name: download.suggestedFilename(),
    text: readFileSync(await download.path(), 'utf8'),
  };
};

/** What a control says its shortcut is, to a pointer and to a reader alike. */
export const shortcutShown = async (
  page: Page,
  control: Locator,
): Promise<{ tooltip: string; keyShortcuts: string; description: string }> => {
  const described = (await control.getAttribute('aria-describedby')) ?? '';
  const note = page.locator(`[id="${described}"]`);
  await expect(note).toHaveCount(1);
  return {
    tooltip: (await control.getAttribute('title')) ?? '',
    keyShortcuts: (await control.getAttribute('aria-keyshortcuts')) ?? '',
    description: (await note.textContent()) ?? '',
  };
};
