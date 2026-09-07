import {
  colourModeStorageKey,
  parseColourMode,
  readColourMode,
  writeColourMode,
} from './theme-preference.js';

describe('colour mode preference', () => {
  it('accepts only the three documented choices', () => {
    expect(parseColourMode('light')).toBe('light');
    expect(parseColourMode('dark')).toBe('dark');
    expect(parseColourMode('invalid')).toBe('system');
    expect(parseColourMode(null)).toBe('system');
  });

  it('reads and writes the local storage choice', () => {
    const storage = new Map<string, string>();
    const store = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    writeColourMode(store, 'dark');

    expect(storage.get(colourModeStorageKey)).toBe('dark');
    expect(readColourMode(store)).toBe('dark');
  });

  it('falls back when storage refuses access', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };

    expect(readColourMode(storage)).toBe('system');
    expect(() => {
      writeColourMode(storage, 'light');
    }).not.toThrow();
  });
});
