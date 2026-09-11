import {
  keyboardResizeStep,
  resizeKeys,
  shiftedKeyboardResizeStep,
} from '@saerskriven/canvas';
import {
  bare,
  describeShortcutEntries,
  enterChord,
  escapeChord,
  firedBy,
  mod,
  shift,
  type Chord,
  type ChordEvent,
  type Platform,
} from './shortcuts.js';

/** The headings used to group contextual keys in the shortcut reference. */
export const contextualGroups = [
  'Canvas navigation',
  'Canvas editing',
  'Flow route',
  'Placement',
  'Connecting',
  'Text editing',
  'Panels',
] as const;

/** One contextual-key heading in the shortcut reference. */
export type ContextualGroup = (typeof contextualGroups)[number];

type ContextualShortcutEntry = {
  readonly id: string;
  readonly label: string;
  readonly group: ContextualGroup;
  readonly shortcuts: readonly Chord[];
  readonly when: string;
};

const arrowKeys = resizeKeys.map(bare);
const shiftedArrowKeys = resizeKeys.map(shift);
const enterKey = [enterChord];
const escapeKey = [escapeChord];

const table = {
  'choose-bend-segment': {
    id: 'choose-bend-segment',
    label: 'Choose a segment for the new bend',
    group: 'Flow route',
    shortcuts: [bare('ArrowLeft'), bare('ArrowRight')],
    when: 'Add bend is choosing a segment',
  },
  'commit-bend': {
    id: 'commit-bend',
    label: 'Start or finish bend placement',
    group: 'Flow route',
    shortcuts: enterKey,
    when: 'A segment or bend position is being chosen',
  },
  'cancel-bend': {
    id: 'cancel-bend',
    label: 'Cancel the bend edit',
    group: 'Flow route',
    shortcuts: escapeKey,
    when: 'A bend gesture, insertion, or action control is active',
  },
  'move-bend': {
    id: 'move-bend',
    label: `Move the bend by ${String(keyboardResizeStep)} units`,
    group: 'Flow route',
    shortcuts: arrowKeys,
    when: 'A bend handle has focus or a bend position is being chosen',
  },
  'move-bend-far': {
    id: 'move-bend-far',
    label: `Move the bend by ${String(shiftedKeyboardResizeStep)} units`,
    group: 'Flow route',
    shortcuts: shiftedArrowKeys,
    when: 'A bend handle has focus or a bend position is being chosen',
  },
  'remove-bend': {
    id: 'remove-bend',
    label: 'Remove the focused bend',
    group: 'Flow route',
    shortcuts: [bare('Delete'), bare('Backspace')],
    when: 'An existing bend handle has focus',
  },
  'pin-flow-end': {
    id: 'pin-flow-end',
    label: 'Pin the focused flow end to the side the arrow points at',
    group: 'Flow route',
    shortcuts: arrowKeys,
    when: 'A flow end handle has focus',
  },
  'release-flow-end': {
    id: 'release-flow-end',
    label: 'Let the focused flow end follow its route',
    group: 'Flow route',
    shortcuts: [bare('Delete'), bare('Backspace')],
    when: 'A flow end handle has focus',
  },
  'focus-canvas-item': {
    id: 'focus-canvas-item',
    label: 'Move focus between canvas items',
    group: 'Canvas navigation',
    shortcuts: [bare('Tab'), shift('Tab')],
    when: 'Focus is on the canvas',
  },
  'select-canvas-item': {
    id: 'select-canvas-item',
    label: 'Select the focused item',
    group: 'Canvas navigation',
    shortcuts: [enterChord, bare(' ')],
    when: 'The focused item is not the only selected item',
  },
  'edit-canvas-text': {
    id: 'edit-canvas-text',
    label: 'Edit the selected canvas text',
    group: 'Canvas navigation',
    shortcuts: enterKey,
    when: 'The focused item is the only selected item',
  },
  'toggle-canvas-item': {
    id: 'toggle-canvas-item',
    label: 'Add or remove the focused item from the selection',
    group: 'Canvas navigation',
    shortcuts: [shift('Enter')],
    when: 'A canvas item has focus',
  },
  'move-selection': {
    id: 'move-selection',
    label: 'Move the selection by 5 units',
    group: 'Canvas editing',
    shortcuts: arrowKeys,
    when: 'A selected canvas item has focus',
  },
  'move-selection-far': {
    id: 'move-selection-far',
    label: 'Move the selection by 20 units',
    group: 'Canvas editing',
    shortcuts: shiftedArrowKeys,
    when: 'A selected canvas item has focus',
  },
  'resize-selection': {
    id: 'resize-selection',
    label: `Move the chosen edge by ${String(keyboardResizeStep)} units`,
    group: 'Canvas editing',
    shortcuts: arrowKeys,
    when: 'A resize control has focus',
  },
  'resize-selection-far': {
    id: 'resize-selection-far',
    label: `Move the chosen edge by ${String(shiftedKeyboardResizeStep)} units`,
    group: 'Canvas editing',
    shortcuts: shiftedArrowKeys,
    when: 'A resize control has focus',
  },
  'place-at-centre': {
    id: 'place-at-centre',
    label: 'Place an item at the viewport centre',
    group: 'Placement',
    shortcuts: enterKey,
    when: 'An item tool is active and no native control has focus',
  },
  'finish-boundary-curve': {
    id: 'finish-boundary-curve',
    label: 'Finish the trust boundary curve',
    group: 'Placement',
    shortcuts: enterKey,
    when: 'A curve has at least two waypoints',
  },
  'move-through-flow-targets': {
    id: 'move-through-flow-targets',
    label: 'Move through flow destinations',
    group: 'Connecting',
    shortcuts: [bare('ArrowUp'), bare('ArrowDown')],
    when: 'The flow destination list is open',
  },
  'choose-flow-target': {
    id: 'choose-flow-target',
    label: 'Choose the flow destination',
    group: 'Connecting',
    shortcuts: enterKey,
    when: 'A destination has focus in the open list',
  },
  'cancel-flow-target': {
    id: 'cancel-flow-target',
    label: 'Cancel the flow',
    group: 'Connecting',
    shortcuts: escapeKey,
    when: 'The flow destination list is open',
  },
  'commit-name': {
    id: 'commit-name',
    label: 'Commit a name',
    group: 'Text editing',
    shortcuts: enterKey,
    when: 'A single-line canvas editor has focus',
  },
  'commit-note': {
    id: 'commit-note',
    label: 'Commit note text',
    group: 'Text editing',
    shortcuts: [mod('Enter')],
    when: 'A Note editor has focus',
  },
  'cancel-canvas-text': {
    id: 'cancel-canvas-text',
    label: 'Cancel canvas text editing',
    group: 'Text editing',
    shortcuts: escapeKey,
    when: 'A canvas text editor has focus',
  },
  'close-threat-panel': {
    id: 'close-threat-panel',
    label: 'Close the threat panel',
    group: 'Panels',
    shortcuts: escapeKey,
    when: 'Focus is inside the threat panel and no listbox is open',
  },
  'close-shortcut-reference': {
    id: 'close-shortcut-reference',
    label: 'Close the shortcut reference',
    group: 'Panels',
    shortcuts: escapeKey,
    when: 'Focus is inside the shortcut reference',
  },
} as const satisfies Record<string, ContextualShortcutEntry>;

/** One contextual shortcut and the situation in which it applies. */
export type ContextualShortcut = ContextualShortcutEntry & {
  readonly id: ContextualShortcutId;
};

/** Every contextual shortcut, in declaration order. */
export const contextualShortcuts: readonly ContextualShortcut[] =
  Object.values(table);

/** The known identifier of one contextual shortcut. */
export type ContextualShortcutId = keyof typeof table;

/** The contextual shortcut named by `id`. */
export function contextualShortcutById(
  id: ContextualShortcutId,
): ContextualShortcut {
  return table[id];
}

/** Whether `event` presses the contextual shortcut named by `id`. */
export function pressesContextualShortcut(
  id: ContextualShortcutId,
  event: ChordEvent,
  platform: Platform,
): boolean {
  return table[id].shortcuts.some((chord) => firedBy(event, chord, platform));
}

/** The spoken description of the selected contextual shortcuts. */
export function describeContextualShortcuts(
  ids: readonly ContextualShortcutId[],
  platform: Platform,
): string {
  return describeShortcutEntries(
    ids.map((id) => table[id]),
    platform,
  );
}
