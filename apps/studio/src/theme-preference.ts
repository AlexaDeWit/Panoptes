export const colourModes = ['system', 'light', 'dark'] as const;

export type ColourMode = (typeof colourModes)[number];

export function isColourMode(value: string): value is ColourMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export const colourModeStorageKey = 'saerskrivenColourMode';

export function parseColourMode(value: string | null): ColourMode {
  return value === 'light' || value === 'dark' ? value : 'system';
}

type ColourModeStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readColourMode(
  storage: ColourModeStorage | undefined,
): ColourMode {
  try {
    return parseColourMode(storage?.getItem(colourModeStorageKey) ?? null);
  } catch {
    return 'system';
  }
}

export function writeColourMode(
  storage: ColourModeStorage | undefined,
  mode: ColourMode,
): void {
  try {
    storage?.setItem(colourModeStorageKey, mode);
  } catch {
    return;
  }
}
