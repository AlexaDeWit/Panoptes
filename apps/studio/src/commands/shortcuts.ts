declare global {
  interface Navigator {
    readonly userAgentData?: { readonly platform?: string };
  }
}

/** The closed set of keys the studio binds. */
export const chordKeys = [
  'a',
  'b',
  'c',
  'd',
  'f',
  'g',
  'h',
  'n',
  'o',
  'p',
  's',
  't',
  'v',
  'x',
  'y',
  'z',
  ' ',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '=',
  '+',
  '-',
  '0',
  'Backspace',
  'Delete',
  'Escape',
  'F1',
  'F2',
  'Tab',
  'Enter',
  'ArrowUp',
  'ArrowRight',
  'ArrowDown',
  'ArrowLeft',
  'PageUp',
  'PageDown',
  '?',
] as const;

/** One key a chord ends on, written as a `KeyboardEvent.key` reports it. */
export type ChordKey = (typeof chordKeys)[number];

/** Mod means Command on Apple platforms and Control elsewhere. */
export const chordModifiers = ['Mod', 'Shift'] as const;

/** One modifier held down through a chord. */
export type ChordModifier = (typeof chordModifiers)[number];

/** One key press a command answers to. */
export type Chord = {
  readonly modifiers: readonly ChordModifier[];
  readonly key: ChordKey;
  readonly character?: true;
  readonly platform?: Platform;
};

/** A key with no command modifier. */
export const bare = (key: ChordKey): Chord => ({ modifiers: [], key });

/** A character whose Shift state is part of producing the character. */
export const character = (
  key: ChordKey,
  modifiers: readonly ChordModifier[] = [],
): Chord => ({
  character: true,
  modifiers,
  key,
});

/** A key with the platform command modifier. */
export const mod = (key: ChordKey, platform?: Platform): Chord => ({
  modifiers: ['Mod'],
  key,
  ...(platform === undefined ? {} : { platform }),
});

/** A key with the platform command modifier and Shift. */
export const modShift = (key: ChordKey): Chord => ({
  modifiers: ['Mod', 'Shift'],
  key,
});

/** A key with Shift. */
export const shift = (key: ChordKey): Chord => ({
  modifiers: ['Shift'],
  key,
});

/** The unmodified Enter chord shared by contextual actions. */
export const enterChord = bare('Enter');

/** The unmodified Escape chord shared by commands and contextual actions. */
export const escapeChord = bare('Escape');

/** The platform conventions used for modifier matching and display. */
export const platforms = ['apple', 'other'] as const;

/** Which convention a chord is written and pressed under. */
export type Platform = (typeof platforms)[number];

/** What a browser says about the machine it is running on. */
export type PlatformHints = {
  readonly platform?: string;
  readonly userAgent?: string;
};

/** Detects Apple platforms from browser platform or user-agent hints. */
export function platformOf(hints: PlatformHints): Platform {
  const written = `${hints.platform ?? ''} ${hints.userAgent ?? ''}`;
  return /mac|iphone|ipad|ipod/iu.test(written) ? 'apple' : 'other';
}

/** The platform detected once when the page loads. */
export const hostPlatform: Platform = platformOf({
  platform: navigator.userAgentData?.platform ?? navigator.platform,
  userAgent: navigator.userAgent,
});

/** The keyboard event fields used to match a chord. */
export type ChordEvent = {
  readonly key: string;
  readonly code?: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  getModifierState?: (modifier: 'AltGraph') => boolean;
};

/** Whether `event` is `chord` on `platform`. */
export function firedBy(
  event: ChordEvent,
  chord: Chord,
  platform: Platform,
): boolean {
  const keyMatches =
    event.key.toLowerCase() === chord.key.toLowerCase() ||
    (chord.modifiers.includes('Mod') &&
      chord.modifiers.includes('Shift') &&
      /^[0-9]$/u.test(chord.key) &&
      event.code === `Digit${chord.key}`);
  const command = platform === 'apple' ? event.metaKey : event.ctrlKey;
  const foreign = platform === 'apple' ? event.ctrlKey : event.metaKey;
  const shiftMatches =
    chord.character === true ||
    event.shiftKey === chord.modifiers.includes('Shift');
  return (
    appliesTo(chord, platform) &&
    keyMatches &&
    command === chord.modifiers.includes('Mod') &&
    shiftMatches &&
    !foreign &&
    !event.altKey &&
    event.getModifierState?.('AltGraph') !== true
  );
}

/** Spells a chord with Apple symbols or modifier names. */
export function spellChord(chord: Chord, platform: Platform): string {
  const written = heldIn(chord, platform).map((modifier) =>
    platform === 'apple' ? appleSymbols[modifier] : modifierWords[modifier],
  );
  const key = spellKey(chord.key);
  return platform === 'apple'
    ? `${written.join('')}${key}`
    : [...written, key].join('+');
}

/** Spells only the shortcuts available on the given platform. */
export function spellShortcuts(
  shortcuts: readonly Chord[],
  platform: Platform,
): string {
  return shortcutsOn(shortcuts, platform)
    .map((chord) => spellChord(chord, platform))
    .join(' or ');
}

/** The spoken description of shortcut entries and their contexts. */
export function describeShortcutEntries(
  entries: readonly {
    readonly label: string;
    readonly shortcuts: readonly Chord[];
    readonly when: string;
  }[],
  platform: Platform,
): string {
  return entries
    .map(
      (entry) =>
        `${entry.label}: ${spellShortcuts(entry.shortcuts, platform)}. ${entry.when}.`,
    )
    .join(' ');
}

/** Declares available chords using ARIA modifier and key names. */
export function keyShortcutsAttribute(
  shortcuts: readonly Chord[],
  platform: Platform,
): string {
  return shortcutsOn(shortcuts, platform)
    .map((chord) =>
      [
        ...heldIn(chord, platform).map(
          (modifier) => ariaNames[platform][modifier],
        ),
        chord.key === '+' ? 'Plus' : spellKey(chord.key),
      ].join('+'),
    )
    .join(' ');
}

/** The chords available on one platform, in display order. */
export function shortcutsOn(
  shortcuts: readonly Chord[],
  platform: Platform,
): readonly Chord[] {
  return shortcuts.filter((chord) => appliesTo(chord, platform));
}

function appliesTo(chord: Chord, platform: Platform): boolean {
  return chord.platform === undefined || chord.platform === platform;
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
  if (key === ' ') {
    return 'Space';
  }
  return key.length === 1 ? key.toUpperCase() : key;
}
