import {
  expect,
  type Download,
  type Locator,
  type Page,
} from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Where React Flow has the canvas, read off the transform it writes. Zoom and
 * fit are the viewport moving with nothing in the model changing, so the
 * transform is the only thing that says they happened.
 */
export const viewportTransform = async (page: Page): Promise<string> =>
  (await page.locator('.react-flow__viewport').getAttribute('style')) ?? '';

/** The scale React Flow applies to model coordinates. */
export const viewportZoom = async (page: Page): Promise<number> =>
  Number(/scale\(([\d.]+)\)/u.exec(await viewportTransform(page))?.[1]);

/** The file a chord asked the browser to download, and what it holds. */
export type SavedByKey = {
  readonly name: string;
  readonly text: string;
};

const downloaded = async (download: Download): Promise<SavedByKey> => ({
  name: download.suggestedFilename(),
  text: readFileSync(await download.path(), 'utf8'),
});

/** Presses `chord` and reads back the file the studio wrote through it. */
export const savedByKey = async (
  page: Page,
  chord: string,
): Promise<SavedByKey> => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.keyboard.press(chord),
  ]);
  return downloaded(download);
};

/**
 * Answers the format question the menu asks where the browser has no save
 * picker, and reads back the file that went out. The question stands in the
 * menu whether a chord or an item put it there, so this waits for the item
 * rather than for the menu.
 */
export const savedFromMenu = async (
  page: Page,
  item: string,
): Promise<SavedByKey> => {
  const chosen = page.getByRole('menuitem', { name: item, exact: true });
  await expect(chosen).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    chosen.click(),
  ]);
  return downloaded(download);
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
