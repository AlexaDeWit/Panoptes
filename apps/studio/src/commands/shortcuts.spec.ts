import {
  firedBy,
  keyShortcutsAttribute,
  platformOf,
  spellChord,
  spellShortcuts,
  type Chord,
} from './shortcuts.js';

const save: Chord = { modifiers: ['Mod'], key: 's' };
const saveAs: Chord = { modifiers: ['Mod', 'Shift'], key: 's' };
const clear: Chord = { modifiers: [], key: 'Escape' };

const press = (over: Partial<Parameters<typeof firedBy>[0]> = {}) => ({
  key: 's',
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...over,
});

describe('platformOf', () => {
  it('reads Apple hardware off either thing a browser offers', () => {
    expect(platformOf({ platform: 'MacIntel' })).toBe('apple');
    expect(platformOf({ platform: 'macOS' })).toBe('apple');
    expect(
      platformOf({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS)' }),
    ).toBe('apple');
  });

  it('writes to a machine it cannot place in words', () => {
    expect(platformOf({ platform: 'Linux x86_64' })).toBe('other');
    expect(platformOf({})).toBe('other');
  });
});

describe('spelling a chord', () => {
  it('writes each platform the way that platform writes it', () => {
    expect(spellChord(save, 'other')).toBe('Ctrl+S');
    expect(spellChord(save, 'apple')).toBe('⌘S');
    expect(spellChord(saveAs, 'other')).toBe('Ctrl+Shift+S');
    expect(spellChord(saveAs, 'apple')).toBe('⇧⌘S');
    expect(spellChord(clear, 'other')).toBe('Escape');
    expect(spellChord(clear, 'apple')).toBe('Escape');
  });

  it('offers both chords of a command that answers to two', () => {
    expect(
      spellShortcuts([saveAs, { modifiers: ['Mod'], key: 'y' }], 'other'),
    ).toBe('Ctrl+Shift+S or Ctrl+Y');
  });

  it('names the modifiers as aria-keyshortcuts does, one entry per chord', () => {
    expect(keyShortcutsAttribute([saveAs], 'other')).toBe('Control+Shift+S');
    expect(keyShortcutsAttribute([saveAs], 'apple')).toBe('Shift+Meta+S');
    expect(keyShortcutsAttribute([save, clear], 'other')).toBe(
      'Control+S Escape',
    );
  });
});

describe('firedBy', () => {
  it('takes the platform command modifier and not the other one', () => {
    expect(firedBy(press({ ctrlKey: true }), save, 'other')).toBe(true);
    expect(firedBy(press({ metaKey: true }), save, 'other')).toBe(false);
    expect(firedBy(press({ metaKey: true }), save, 'apple')).toBe(true);
    expect(firedBy(press({ ctrlKey: true }), save, 'apple')).toBe(false);
  });

  it('refuses a modifier the chord does not name', () => {
    expect(
      firedBy(press({ ctrlKey: true, shiftKey: true }), save, 'other'),
    ).toBe(false);
    expect(firedBy(press({ ctrlKey: true, altKey: true }), save, 'other')).toBe(
      false,
    );
    expect(firedBy(press({ key: 's' }), save, 'other')).toBe(false);
  });

  it('reads the key a shifted press reports, which is the capital', () => {
    expect(
      firedBy(
        press({ key: 'S', ctrlKey: true, shiftKey: true }),
        saveAs,
        'other',
      ),
    ).toBe(true);
  });
});
