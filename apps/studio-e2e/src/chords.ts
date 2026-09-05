/**
 * Every chord the studio registers, as Playwright presses them.
 * `ControlOrMeta` is the platform command modifier the registry writes as
 * `Mod`, so one entry drives the binding a person holds on either machine.
 * The list is the browser half of the registry's own spec: what is here is
 * pressed once, and what is not here is a command with no keyboard route.
 * `tests/chords.spec.ts` holds it against the registry, so a chord that
 * moves on one side and not the other is a red test rather than a shortcut
 * nothing drives.
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
