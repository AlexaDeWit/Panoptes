import type { Diagram, DiagramId } from '@saerskriven/model';
import { announce } from '../canvas/announcements.js';
import { startFlow } from '../canvas/connecting.js';
import { removeSelected, renameSelected, selectAll } from '../canvas/edits.js';
import { selectTool, type Tool } from '../canvas/tools.js';
import { focusThreatPanel } from '../panel/panel-focus.js';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  bare,
  character,
  escapeChord,
  firedBy,
  mod,
  modShift,
  spellShortcuts,
  type Chord,
  type ChordEvent,
  type Platform,
} from './shortcuts.js';

/**
 * Opening, saving, exporting and closing, which reach the file session
 * around it rather than the store alone. `close` asks rather than closes
 * where the model has changes in no file: the reducer is total and cannot
 * refuse, so the guard sits with the session that holds the answer.
 */
export type FileCommands = {
  open(): void;
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
};

/** The shortcut reference controlled by a registered command. */
export type ReferenceCommands = {
  toggle(): void;
};

/**
 * What a command reaches that the store and the canvas edits do not offer as
 * module-level functions: the file bridge, which a component holds a picker
 * for, and the viewport, which is React Flow's and lives for as long as the
 * canvas is mounted. The app builds one and hands it to every route into the
 * registry, so a keyboard chord and a control run one dispatch against one
 * set of collaborators.
 */
export type CommandSurface = {
  readonly files: FileCommands;
  readonly reference: ReferenceCommands;
  readonly view: ViewCommands;
};

/**
 * What running a command does. `pending` names the issue that will give the
 * command a dispatch: the chord is registered and shown now so the shortcut
 * a person learns does not move when the surface that answers it lands, and
 * the studio claims the key press rather than leaving it to the browser.
 */
export type CommandDispatch =
  | { readonly kind: 'runs'; readonly run: (surface: CommandSurface) => void }
  | { readonly kind: 'pending'; readonly issue: number };

/** One command, before its id is bound to the table's own keys. */
export type CommandEntry = {
  readonly id: string;
  readonly label: string;
  readonly group: CommandGroup;
  readonly shortcuts: readonly Chord[];
  readonly when: string;
  readonly inTextFields: boolean;
  readonly dispatch: CommandDispatch;
};

/** The headings used to group commands in the shortcut reference. */
export const commandGroups = ['File', 'Edit', 'View', 'Tools', 'Help'] as const;

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

const table = {
  open: {
    id: 'open',
    label: 'Open a model',
    group: 'File',
    shortcuts: [mod('o')],
    when: 'Outside text fields',
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.files.open();
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
    label: 'Close the file',
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
    shortcuts: [modShift('z'), mod('y')],
    when: 'Anywhere in the studio',
    inTextFields: true,
    dispatch: history(Action.Redo(), 'Redo completed.'),
  },
  delete: {
    id: 'delete',
    label: 'Delete the selection',
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
    label: 'Rename the selection',
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
    shortcuts: [mod('=')],
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
  return ids
    .map((id) => {
      const entry = table[id];
      return `${entry.label}: ${spellShortcuts(entry.shortcuts, platform)}. ${entry.when}.`;
    })
    .join(' ');
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

/**
 * Which command each toolbox mode belongs to, so the buttons and their keys
 * select one mode through one dispatch.
 */
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

/**
 * The command `event` presses, and nothing at all where it presses none. The
 * first match wins, which the registry's spec keeps meaningful by holding
 * that no two commands answer to one chord.
 */
export function commandFor(
  event: ChordEvent,
  platform: Platform,
): Command | undefined {
  return commands.find((command) =>
    command.shortcuts.some((chord) => firedBy(event, chord, platform)),
  );
}

/**
 * Runs `command` against `surface`. A command whose surface has not landed
 * does nothing rather than reporting, since a person pressing a key the
 * studio advertises has nothing to act on.
 */
export function runCommand(command: Command, surface: CommandSurface): void {
  if (command.dispatch.kind === 'runs') {
    command.dispatch.run(surface);
  }
}
