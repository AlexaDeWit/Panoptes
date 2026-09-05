declare global {
  interface Navigator {
    readonly userAgentData?: { readonly platform?: string };
  }
}

/**
 * Every key a shortcut is built on. The set is closed so that a chord names a
 * key the studio has decided to bind rather than any string a keyboard can
 * produce, and so that two commands reaching for one key is a comparison over
 * a known alphabet.
 */
export const chordKeys = [
  'a',
  'b',
  'c',
  'f',
  'h',
  'o',
  'p',
  's',
  'v',
  'x',
  'y',
  'z',
  '=',
  '-',
  '0',
  'Backspace',
  'Delete',
  'Escape',
] as const;

/** One key a chord ends on, written as a `KeyboardEvent.key` reports it. */
export type ChordKey = (typeof chordKeys)[number];

/**
 * The modifiers a chord holds. `Mod` is the platform's command modifier,
 * Command on Apple hardware and Control everywhere else, so one chord is
 * written once and read as the platform writes it.
 */
export const chordModifiers = ['Mod', 'Shift'] as const;

/** One modifier held down through a chord. */
export type ChordModifier = (typeof chordModifiers)[number];

/** One key press a command answers to. */
export type Chord = {
  readonly modifiers: readonly ChordModifier[];
  readonly key: ChordKey;
};

/**
 * The two conventions a shortcut is written and pressed under. Apple hardware
 * carries the Command key and spells a chord in symbols; everything else
 * holds Control and spells it in words.
 */
export const platforms = ['apple', 'other'] as const;

/** Which convention a chord is written and pressed under. */
export type Platform = (typeof platforms)[number];

/** What a browser says about the machine it is running on. */
export type PlatformHints = {
  readonly platform?: string;
  readonly userAgent?: string;
};

/**
 * Which convention `hints` describes. Both fields are read because
 * `navigator.platform` is deprecated and the user agent data that replaces it
 * is not offered by every browser, and neither is worth a second guess: a
 * machine that says nothing recognizable is written to in words.
 */
export function platformOf(hints: PlatformHints): Platform {
  const written = `${hints.platform ?? ''} ${hints.userAgent ?? ''}`;
  return /mac|iphone|ipad|ipod/iu.test(written) ? 'apple' : 'other';
}

/**
 * The machine the studio is running on, settled once at load. Nothing about
 * it changes while a page is open, and a control that renders a shortcut
 * would otherwise ask on every render.
 */
export const hostPlatform: Platform = platformOf({
  platform: navigator.userAgentData?.platform ?? navigator.platform,
  userAgent: navigator.userAgent,
});

/**
 * A key press, as much of one as a chord is matched against. It is
 * structural, so a `KeyboardEvent` satisfies it and a spec hands over a
 * literal without a browser.
 */
export type ChordEvent = {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  getModifierState?: (modifier: string) => boolean;
};

/**
 * Whether `event` is `chord` on `platform`. The match is exact in both
 * directions: a modifier the chord does not name has to be up, so Command
 * plus Z on Apple hardware is undo and Control plus Z is nothing, and a
 * command bound to a bare letter does not fire under a modifier that belongs
 * to the browser. AltGr is asked for by name rather than read off `altKey`,
 * which it sets on Windows and not on Linux: a layout that writes a
 * character with it is writing, not pressing a shortcut.
 */
export function firedBy(
  event: ChordEvent,
  chord: Chord,
  platform: Platform,
): boolean {
  const command = platform === 'apple' ? event.metaKey : event.ctrlKey;
  const foreign = platform === 'apple' ? event.ctrlKey : event.metaKey;
  return (
    event.key.toLowerCase() === chord.key.toLowerCase() &&
    command === chord.modifiers.includes('Mod') &&
    event.shiftKey === chord.modifiers.includes('Shift') &&
    !foreign &&
    !event.altKey &&
    event.getModifierState?.('AltGraph') !== true
  );
}

/**
 * One chord as its platform writes it: symbols run together on Apple
 * hardware, words joined by a plus sign elsewhere.
 */
export function spellChord(chord: Chord, platform: Platform): string {
  const written = heldIn(chord, platform).map((modifier) =>
    platform === 'apple' ? appleSymbols[modifier] : modifierWords[modifier],
  );
  const key = spellKey(chord.key);
  return platform === 'apple'
    ? `${written.join('')}${key}`
    : [...written, key].join('+');
}

/**
 * Every chord a command answers to, as one phrase for a person to read. A
 * command with two of them offers both rather than picking one, because
 * neither is the fallback of the other.
 */
export function spellShortcuts(
  shortcuts: readonly Chord[],
  platform: Platform,
): string {
  return shortcuts.map((chord) => spellChord(chord, platform)).join(' or ');
}

/**
 * The same chords as `aria-keyshortcuts` declares them: modifiers under the
 * names a `KeyboardEvent` gives them, in the order the attribute asks for,
 * chords separated by a space. It is the one attribute that says which key
 * runs a control, so assistive technology reads the binding rather than the
 * studio's spelling of it.
 */
export function keyShortcutsAttribute(
  shortcuts: readonly Chord[],
  platform: Platform,
): string {
  return shortcuts
    .map((chord) =>
      [
        ...heldIn(chord, platform).map(
          (modifier) => ariaNames[platform][modifier],
        ),
        spellKey(chord.key),
      ].join('+'),
    )
    .join(' ');
}

const appleSymbols: Record<ChordModifier, string> = {
  Shift: '⇧',
  Mod: '⌘',
};

const modifierWords: Record<ChordModifier, string> = {
  Mod: 'Ctrl',
  Shift: 'Shift',
};

const ariaNames: Record<Platform, Record<ChordModifier, string>> = {
  apple: { Shift: 'Shift', Mod: 'Meta' },
  other: { Mod: 'Control', Shift: 'Shift' },
};

const modifierOrder: Record<Platform, readonly ChordModifier[]> = {
  apple: ['Shift', 'Mod'],
  other: ['Mod', 'Shift'],
};

function heldIn(chord: Chord, platform: Platform): readonly ChordModifier[] {
  return modifierOrder[platform].filter((modifier) =>
    chord.modifiers.includes(modifier),
  );
}

function spellKey(key: ChordKey): string {
  return key.length === 1 ? key.toUpperCase() : key;
}
