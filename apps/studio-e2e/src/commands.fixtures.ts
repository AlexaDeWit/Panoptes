import { expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Every chord the studio registers, as Playwright presses them.
 * `ControlOrMeta` is the platform command modifier the registry writes as
 * `Mod`, so one entry drives the binding a person holds on either machine.
 * The list is the browser half of the registry's own spec: what is here is
 * pressed once, and what is not here is a command with no keyboard route.
 */
export const registeredChords = {
  open: ['ControlOrMeta+o'],
  save: ['ControlOrMeta+s'],
  'save-as': ['ControlOrMeta+Shift+s'],
  'close-file': ['ControlOrMeta+Shift+x'],
  undo: ['ControlOrMeta+z'],
  redo: ['ControlOrMeta+Shift+z', 'ControlOrMeta+y'],
  delete: ['Delete', 'Backspace'],
  'select-all': ['ControlOrMeta+a'],
  'clear-selection': ['Escape'],
  'fit-to-view': ['ControlOrMeta+0'],
  'zoom-in': ['ControlOrMeta+='],
  'zoom-out': ['ControlOrMeta+-'],
  'start-flow': ['f'],
  'select-tool': ['v'],
  'hand-tool': ['h'],
  'actor-tool': ['a'],
  'process-tool': ['p'],
  'store-tool': ['s'],
  'boundary-box-tool': ['b'],
  'boundary-curve-tool': ['c'],
} as const;

/** The commands whose surface has not landed, and the chord each claims. */
export const chordsWaitingOnASurface = [
  registeredChords['close-file'][0],
  registeredChords['select-all'][0],
  registeredChords['start-flow'][0],
  registeredChords['select-tool'][0],
  registeredChords['hand-tool'][0],
];

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
