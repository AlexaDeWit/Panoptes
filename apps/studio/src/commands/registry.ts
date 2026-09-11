import type { Diagram, DiagramId } from '@saerskriven/model';
import {
  copySelected,
  duplicateSelected,
  pasteSelected,
} from '../canvas/clipboard.js';
import { arrangeSelected } from '../canvas/arrangement.js';
import { openSelectionControl } from '../canvas/selection-control.js';
import { toggleSnap } from '../canvas/snap.js';
import { announce } from '../canvas/announcements.js';
import { startFlow } from '../canvas/connecting.js';
import { startBendInsertion } from '../canvas/bend-insertion.js';
import {
  beginRenamingDiagram,
  createDiagram,
  stepDiagram,
} from '../canvas/diagrams.js';
import {
  removeSelected,
  renameSelected,
  selectAll,
  toggleFlowDirection,
} from '../canvas/edits.js';
import { selectTool, type Tool } from '../canvas/tools.js';
import { focusThreatPanel } from '../panel/panel-focus.js';
import { Action } from '../store/actions.js';
import { severalDiagrams } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  bare,
  character,
  describeShortcutEntries,
  escapeChord,
  firedBy,
  mod,
  modShift,
  type Chord,
  type ChordEvent,
  type Platform,
} from './shortcuts.js';

/** File operations whose session guards unsaved changes before replacing the model. */
export type FileCommands = {
  open(): void;
  import(): void;
  save(): void;
  saveAs(): void;
  exportDiagram(diagramId?: DiagramId): void;
  exportRegister(): void;
  exportTypst(): void;
  exportPdf(): void;
  close(): void;
};

/** Moving the canvas, which is React Flow's viewport rather than the model. */
export type ViewCommands = {
  zoomIn(): void;
  zoomOut(): void;
  fitToView(): void;
  fitSelection(): void;
  resetZoom(): void;
};

/** The shortcut reference controlled by a registered command. */
export type ReferenceCommands = {
  toggle(): void;
};

/** Commands that use the file session, shortcut reference, or canvas viewport. */
export type CommandSurface = {
  readonly files: FileCommands;
  readonly reference: ReferenceCommands;
  readonly view: ViewCommands;
};

/** A runnable command or a reserved shortcut waiting for its issue. */
export type CommandDispatch =
  | { readonly kind: 'runs'; readonly run: (surface: CommandSurface) => void }
  | { readonly kind: 'pending'; readonly issue: number };

/**
 * One command, before its id is bound to the table's own keys. A command
 * with `available` claims its chord from the browser only while that holds
 * of the store, so a key the studio has no use for in the current model
 * keeps doing what the browser does with it. Only the key binding reads it:
 * a menu item or button for such a command is drawn only where the command
 * is available, rather than disabled by it.
 */
export type CommandEntry = {
  readonly id: string;
  readonly label: string;
  readonly group: CommandGroup;
  readonly shortcuts: readonly Chord[];
  readonly when: string;
  readonly inTextFields: boolean;
  readonly available?: (state: State) => boolean;
  readonly dispatch: CommandDispatch;
};

/** The headings used to group commands in the shortcut reference. */
export const commandGroups = [
  'File',
  'Edit',
  'View',
  'Diagram',
  'Tools',
  'Help',
] as const;

/** One command heading in the shortcut reference. */
export type CommandGroup = (typeof commandGroups)[number];

const runs = (run: (surface: CommandSurface) => void): CommandDispatch => ({
  kind: 'runs',
  run,
});

const activates = (tool: Tool): CommandDispatch =>
  runs(() => {
    selectTool(tool);
  });

const history = (action: Action, message: string): CommandDispatch =>
  runs(() => {
    const before = modelStore.getState().present;
    dispatch(action);
    if (modelStore.getState().present !== before) {
      announce(message);
    }
  });

const editCommand = <const Id extends string>({
  id,
  label,
  run,
  shortcuts,
}: Pick<CommandEntry, 'label' | 'shortcuts'> & {
  readonly id: Id;
  readonly run: () => void;
}): CommandEntry & { readonly id: Id } => ({
  id,
  label,
  group: 'Edit',
  shortcuts,
  when: 'With a canvas selection, outside text fields and open overlays',
  inTextFields: false,
  dispatch: runs(run),
});

const table = {
  copy: editCommand({
    id: 'copy',
    label: 'Copy',
    shortcuts: [mod('c')],
    run: () => {
      void copySelected();
    },
  }),
  cut: editCommand({
    id: 'cut',
    label: 'Cut',
    shortcuts: [mod('x')],
    run: () => {
      void copySelected(true);
    },
  }),
  paste: editCommand({
    id: 'paste',
    label: 'Paste',
    shortcuts: [mod('v')],
    run: () => {
      void pasteSelected();
    },
  }),
  duplicate: editCommand({
    id: 'duplicate',
    label: 'Duplicate',
    shortcuts: [mod('d')],
    run: () => {
      duplicateSelected();
    },
  }),
  'edit-geometry': editCommand({
    id: 'edit-geometry',
    label: 'Position and size',
    shortcuts: [modShift('p')],
    run: () => {
      openSelectionControl('geometry');
    },
  }),
  'reconnect-source': editCommand({
    id: 'reconnect-source',
    label: 'Change flow source',
    shortcuts: [modShift('1')],
    run: () => {
      openSelectionControl('source');
    },
  }),
  'reconnect-target': editCommand({
    id: 'reconnect-target',
    label: 'Change flow target',
    shortcuts: [modShift('2')],
    run: () => {
      openSelectionControl('target');
    },
  }),
  'toggle-flow-direction': editCommand({
    id: 'toggle-flow-direction',
    label: 'Toggle bidirectional flow',
    shortcuts: [modShift('3')],
    run: toggleFlowDirection,
  }),
  'align-left': editCommand({
    id: 'align-left',
    label: 'Align left',
    shortcuts: [modShift('ArrowLeft')],
    run: () => {
      arrangeSelected('left');
    },
  }),
  'align-centre': editCommand({
    id: 'align-centre',
    label: 'Align centres',
    shortcuts: [modShift('h')],
    run: () => {
      arrangeSelected('centre');
    },
  }),
  'align-right': editCommand({
    id: 'align-right',
    label: 'Align right',
    shortcuts: [modShift('ArrowRight')],
    run: () => {
      arrangeSelected('right');
    },
  }),
  'align-top': editCommand({
    id: 'align-top',
    label: 'Align top',
    shortcuts: [modShift('ArrowUp')],
    run: () => {
      arrangeSelected('top');
    },
  }),
  'align-middle': editCommand({
    id: 'align-middle',
    label: 'Align middles',
    shortcuts: [modShift('v')],
    run: () => {
      arrangeSelected('middle');
    },
  }),
  'align-bottom': editCommand({
    id: 'align-bottom',
    label: 'Align bottom',
    shortcuts: [modShift('ArrowDown')],
    run: () => {
      arrangeSelected('bottom');
    },
  }),
  'distribute-horizontal': editCommand({
    id: 'distribute-horizontal',
    label: 'Distribute horizontally',
    shortcuts: [modShift('d')],
    run: () => {
      arrangeSelected('horizontal');
    },
  }),
  'distribute-vertical': editCommand({
    id: 'distribute-vertical',
    label: 'Distribute vertically',
    shortcuts: [modShift('b')],
    run: () => {
      arrangeSelected('vertical');
    },
  }),
  'snap-to-grid': {
    id: 'snap-to-grid',
    label: 'Snap to grid',
    group: 'View',
    shortcuts: [modShift('g')],
    when: 'From the View menu',
    inTextFields: false,
    dispatch: runs(toggleSnap),
  },
  'reset-zoom': {
    id: 'reset-zoom',
    label: 'Reset zoom to 100%',
    group: 'View',
    shortcuts: [mod('1')],
    when: 'Outside text fields',
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.view.resetZoom();
    }),
  },
  'fit-selection': {
    id: 'fit-selection',
    label: 'Fit selection',
    group: 'View',
    shortcuts: [modShift('0')],
    when: 'With a canvas selection, outside text fields',
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.view.fitSelection();
    }),
  },
  'next-diagram': {
    id: 'next-diagram',
    label: 'Next diagram',
    group: 'Diagram',
    shortcuts: [bare('PageDown')],
    when: 'The model holds more than one diagram and focus is outside a text field',
    inTextFields: false,
    available: severalDiagrams,
    dispatch: runs(() => {
      stepDiagram('next');
    }),
  },
  'previous-diagram': {
    id: 'previous-diagram',
    label: 'Previous diagram',
    group: 'Diagram',
    shortcuts: [bare('PageUp')],
    when: 'The model holds more than one diagram and focus is outside a text field',
    inTextFields: false,
    available: severalDiagrams,
    dispatch: runs(() => {
      stepDiagram('previous');
    }),
  },
  'new-diagram': {
    id: 'new-diagram',
    label: 'New diagram',
    group: 'Diagram',
    shortcuts: [],
    when: 'From the diagram switcher',
    inTextFields: false,
    dispatch: runs(() => {
      createDiagram();
    }),
  },
  'rename-diagram': {
    id: 'rename-diagram',
    label: 'Rename diagram',
    group: 'Diagram',
    shortcuts: [],
    when: 'From the diagram switcher, while the model holds a diagram',
    inTextFields: false,
    dispatch: runs(beginRenamingDiagram),
  },
  open: {
    id: 'open',
    label: 'Open',
    group: 'File',
    shortcuts: [mod('o')],
    when: 'Outside text fields',
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.files.open();
    }),
  },
  import: {
    id: 'import',
    label: 'Import',
    group: 'File',
    shortcuts: [],
    when: 'Convert an OTM or TM-BOM file into a new native model',
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.files.import();
    }),
  },
  save: {
    id: 'save',
    label: 'Save',
    group: 'File',
    shortcuts: [mod('s')],
    when: 'Anywhere in the studio',
    inTextFields: true,
    dispatch: runs((surface) => {
      surface.files.save();
    }),
  },
  'save-as': {
    id: 'save-as',
    label: 'Save as',
    group: 'File',
    shortcuts: [modShift('s')],
    when: 'Anywhere in the studio',
    inTextFields: true,
    dispatch: runs((surface) => {
      surface.files.saveAs();
    }),
  },
  'export-diagram': {
    id: 'export-diagram',
    label: 'Diagram as SVG',
    group: 'File',
    shortcuts: [],
    when: 'From the File menu',
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.files.exportDiagram();
    }),
  },
  'export-register': {
    id: 'export-register',
    label: 'Register as Markdown',
    group: 'File',
    shortcuts: [],
    when: 'From the File menu',
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.files.exportRegister();
    }),
  },
  'export-typst': {
    id: 'export-typst',
    label: 'Model as Typst',
    group: 'File',
    shortcuts: [],
    when: 'From the File menu',
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.files.exportTypst();
    }),
  },
  'export-pdf': {
    id: 'export-pdf',
    label: 'Model as PDF',
    group: 'File',
    shortcuts: [],
    when: 'From the File menu',
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.files.exportPdf();
    }),
  },
  'close-file': {
    id: 'close-file',
    label: 'New model',
    group: 'File',
    shortcuts: [modShift('x')],
    when: 'Outside text fields',
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.files.close();
    }),
  },
  undo: {
    id: 'undo',
    label: 'Undo',
    group: 'Edit',
    shortcuts: [mod('z')],
    when: 'Anywhere in the studio',
    inTextFields: true,
    dispatch: history(Action.Undo(), 'Undo completed.'),
  },
  redo: {
    id: 'redo',
    label: 'Redo',
    group: 'Edit',
    shortcuts: [modShift('z'), mod('y', 'other')],
    when: 'Anywhere in the studio',
    inTextFields: true,
    dispatch: history(Action.Redo(), 'Redo completed.'),
  },
  delete: {
    id: 'delete',
    label: 'Delete selection',
    group: 'Edit',
    shortcuts: [bare('Delete'), bare('Backspace')],
    when: 'A canvas selection exists and focus is outside a text field',
    inTextFields: false,
    dispatch: runs(() => {
      removeSelected();
    }),
  },
  rename: {
    id: 'rename',
    label: 'Rename selection',
    group: 'Edit',
    shortcuts: [bare('F2')],
    when: 'One renameable canvas item is selected',
    inTextFields: false,
    dispatch: runs(() => {
      renameSelected();
    }),
  },
  'focus-threats': {
    id: 'focus-threats',
    label: 'Focus threats',
    group: 'Edit',
    shortcuts: [bare('t')],
    when: 'One canvas item is selected and focus is outside a text field',
    inTextFields: false,
    dispatch: runs(() => {
      focusThreatPanel();
    }),
  },
  'select-all': {
    id: 'select-all',
    label: 'Select all',
    group: 'Edit',
    shortcuts: [mod('a')],
    when: 'Focus is outside a text field',
    inTextFields: false,
    dispatch: runs(() => {
      selectAll();
    }),
  },
  'fit-to-view': {
    id: 'fit-to-view',
    label: 'Fit to view',
    group: 'View',
    shortcuts: [mod('0')],
    when: 'Focus is outside a text field',
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.view.fitToView();
    }),
  },
  'zoom-in': {
    id: 'zoom-in',
    label: 'Zoom in',
    group: 'View',
    shortcuts: [mod('='), character('+', ['Mod'])],
    when: 'Focus is outside a text field',
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.view.zoomIn();
    }),
  },
  'zoom-out': {
    id: 'zoom-out',
    label: 'Zoom out',
    group: 'View',
    shortcuts: [mod('-')],
    when: 'Focus is outside a text field',
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.view.zoomOut();
    }),
  },
  'add-bend': {
    id: 'add-bend',
    label: 'Add bend',
    group: 'Edit',
    shortcuts: [character('+')],
    when: 'One flow is selected',
    inTextFields: false,
    dispatch: runs(startBendInsertion),
  },
  'start-flow': {
    id: 'start-flow',
    label: 'Start a flow',
    group: 'Edit',
    shortcuts: [bare('f')],
    when: 'One canvas item is selected',
    inTextFields: false,
    dispatch: runs(() => {
      startFlow();
    }),
  },
  'select-tool': {
    id: 'select-tool',
    label: 'Select',
    group: 'Tools',
    shortcuts: [bare('v'), escapeChord, bare('1')],
    when: 'Outside text fields. Escape cancels placement and clears selection',
    inTextFields: false,
    dispatch: activates('select'),
  },
  'hand-tool': {
    id: 'hand-tool',
    label: 'Hand',
    group: 'Tools',
    shortcuts: [bare('h'), bare(' ')],
    when: 'Hold Space for a temporary Hand tool outside text fields',
    inTextFields: false,
    dispatch: activates('hand'),
  },
  'actor-tool': {
    id: 'actor-tool',
    label: 'Actor',
    group: 'Tools',
    shortcuts: [bare('a'), bare('2')],
    when: 'Focus is outside a text field or open menu',
    inTextFields: false,
    dispatch: activates('actor'),
  },
  'process-tool': {
    id: 'process-tool',
    label: 'Process',
    group: 'Tools',
    shortcuts: [bare('p'), bare('3')],
    when: 'Focus is outside a text field or open menu',
    inTextFields: false,
    dispatch: activates('process'),
  },
  'store-tool': {
    id: 'store-tool',
    label: 'Store',
    group: 'Tools',
    shortcuts: [bare('s'), bare('4')],
    when: 'Focus is outside a text field or open menu',
    inTextFields: false,
    dispatch: activates('store'),
  },
  'note-tool': {
    id: 'note-tool',
    label: 'Note',
    group: 'Tools',
    shortcuts: [bare('n'), bare('7')],
    when: 'Focus is outside a text field or open menu',
    inTextFields: false,
    dispatch: activates('note'),
  },
  'boundary-box-tool': {
    id: 'boundary-box-tool',
    label: 'Trust boundary',
    group: 'Tools',
    shortcuts: [bare('b'), bare('5')],
    when: 'Focus is outside a text field or open menu',
    inTextFields: false,
    dispatch: activates('boundary-box'),
  },
  'boundary-curve-tool': {
    id: 'boundary-curve-tool',
    label: 'Trust boundary curve',
    group: 'Tools',
    shortcuts: [bare('c'), bare('6')],
    when: 'Focus is outside a text field or open menu',
    inTextFields: false,
    dispatch: activates('boundary-curve'),
  },
  'shortcut-reference': {
    id: 'shortcut-reference',
    label: 'Keyboard shortcuts',
    group: 'Help',
    shortcuts: [character('?'), bare('F1')],
    when: 'Focus is outside a text field or open menu',
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.reference.toggle();
    }),
  },
} as const satisfies Record<string, CommandEntry>;

/** Every command the studio offers, named once. */
export type CommandId = keyof typeof table;

/** One command: what it is called, what presses it, and what it then does. */
export type Command = CommandEntry & { readonly id: CommandId };

/** Every command, in the order the registry declares them. */
export const commands: readonly Command[] = Object.values(table);

/** The command `id` names. */
export function commandById(id: CommandId): Command {
  return table[id];
}

/** The spoken description of the selected registered commands. */
export function describeCommandShortcuts(
  ids: readonly CommandId[],
  platform: Platform,
): string {
  return describeShortcutEntries(
    ids.map((id) => table[id]),
    platform,
  );
}

/** The SVG command bound to one diagram in a model of one or several. */
export function diagramExportCommand(
  diagram: Diagram,
  several: boolean,
): Command {
  const command = commandById('export-diagram');
  return {
    ...command,
    label: several ? `${command.label}: ${diagram.title}` : command.label,
    dispatch: runs((surface) => {
      surface.files.exportDiagram(diagram.id);
    }),
  };
}

/** The registered command for each toolbox mode. */
export const toolCommands = {
  select: 'select-tool',
  actor: 'actor-tool',
  process: 'process-tool',
  store: 'store-tool',
  note: 'note-tool',
  'boundary-box': 'boundary-box-tool',
  'boundary-curve': 'boundary-curve-tool',
  hand: 'hand-tool',
} as const satisfies Record<Tool, CommandId>;

/** Returns the first command whose shortcut matches the event. */
export function commandFor(
  event: ChordEvent,
  platform: Platform,
): Command | undefined {
  return commands.find((command) =>
    command.shortcuts.some((chord) => firedBy(event, chord, platform)),
  );
}

/** Runs a command against the mounted surface when its dispatch is available. */
export function runCommand(command: Command, surface: CommandSurface): void {
  if (command.dispatch.kind === 'runs') {
    command.dispatch.run(surface);
  }
}
