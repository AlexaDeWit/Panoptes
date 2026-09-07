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
  'export-diagram': [],
  'export-register': [],
  'export-typst': [],
  'export-pdf': [],
  'close-file': ['ControlOrMeta+Shift+x'],
  undo: ['ControlOrMeta+z'],
  redo: ['ControlOrMeta+Shift+z', 'ControlOrMeta+y'],
  delete: ['Delete', 'Backspace'],
  rename: ['F2'],
  'select-all': ['ControlOrMeta+a'],
  'fit-to-view': ['ControlOrMeta+0'],
  'zoom-in': ['ControlOrMeta+='],
  'zoom-out': ['ControlOrMeta+-'],
  'start-flow': ['f'],
  'select-tool': ['v', 'Escape', '1'],
  'hand-tool': ['h', 'Space'],
  'actor-tool': ['a', '2'],
  'process-tool': ['p', '3'],
  'store-tool': ['s', '4'],
  'boundary-box-tool': ['b', '5'],
  'boundary-curve-tool': ['c', '6'],
  'note-tool': ['n', '7'],
} as const;
