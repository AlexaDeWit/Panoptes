import { addPaletteElement, removeSelected } from '../canvas/edits.js';
import type { PaletteKind } from '../canvas/elements.js';
import { Action } from '../store/actions.js';
import { dispatch } from '../store/store.js';
import {
  firedBy,
  type Chord,
  type ChordEvent,
  type ChordKey,
  type Platform,
} from './shortcuts.js';

/** Opening and saving, which reach the file bridge rather than the store. */
export type FileCommands = {
  open(): void;
  save(): void;
  saveAs(): void;
};

/** Moving the canvas, which is React Flow's viewport rather than the model. */
export type ViewCommands = {
  zoomIn(): void;
  zoomOut(): void;
  fitToView(): void;
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
  readonly shortcuts: readonly Chord[];
  readonly inTextFields: boolean;
  readonly dispatch: CommandDispatch;
};

const mod = (key: ChordKey): Chord => ({ modifiers: ['Mod'], key });

const modShift = (key: ChordKey): Chord => ({
  modifiers: ['Mod', 'Shift'],
  key,
});

const bare = (key: ChordKey): Chord => ({ modifiers: [], key });

const runs = (run: (surface: CommandSurface) => void): CommandDispatch => ({
  kind: 'runs',
  run,
});

const pending = (issue: number): CommandDispatch => ({
  kind: 'pending',
  issue,
});

const adds = (kind: PaletteKind): CommandDispatch =>
  runs(() => {
    addPaletteElement(kind);
  });

const table = {
  open: {
    id: 'open',
    label: 'Open a model',
    shortcuts: [mod('o')],
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.files.open();
    }),
  },
  save: {
    id: 'save',
    label: 'Save',
    shortcuts: [mod('s')],
    inTextFields: true,
    dispatch: runs((surface) => {
      surface.files.save();
    }),
  },
  'save-as': {
    id: 'save-as',
    label: 'Save as',
    shortcuts: [modShift('s')],
    inTextFields: true,
    dispatch: runs((surface) => {
      surface.files.saveAs();
    }),
  },
  'close-file': {
    id: 'close-file',
    label: 'Close the file',
    shortcuts: [modShift('x')],
    inTextFields: false,
    dispatch: pending(174),
  },
  undo: {
    id: 'undo',
    label: 'Undo',
    shortcuts: [mod('z')],
    inTextFields: true,
    dispatch: runs(() => {
      dispatch(Action.Undo());
    }),
  },
  redo: {
    id: 'redo',
    label: 'Redo',
    shortcuts: [modShift('z'), mod('y')],
    inTextFields: true,
    dispatch: runs(() => {
      dispatch(Action.Redo());
    }),
  },
  delete: {
    id: 'delete',
    label: 'Delete the selection',
    shortcuts: [bare('Delete'), bare('Backspace')],
    inTextFields: false,
    dispatch: runs(() => {
      removeSelected();
    }),
  },
  'select-all': {
    id: 'select-all',
    label: 'Select all',
    shortcuts: [mod('a')],
    inTextFields: false,
    dispatch: pending(156),
  },
  'clear-selection': {
    id: 'clear-selection',
    label: 'Clear the selection',
    shortcuts: [bare('Escape')],
    inTextFields: false,
    dispatch: runs(() => {
      dispatch(Action.Select({ elementId: undefined }));
    }),
  },
  'fit-to-view': {
    id: 'fit-to-view',
    label: 'Fit to view',
    shortcuts: [mod('0')],
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.view.fitToView();
    }),
  },
  'zoom-in': {
    id: 'zoom-in',
    label: 'Zoom in',
    shortcuts: [mod('=')],
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.view.zoomIn();
    }),
  },
  'zoom-out': {
    id: 'zoom-out',
    label: 'Zoom out',
    shortcuts: [mod('-')],
    inTextFields: false,
    dispatch: runs((surface) => {
      surface.view.zoomOut();
    }),
  },
  'start-flow': {
    id: 'start-flow',
    label: 'Start a flow',
    shortcuts: [bare('f')],
    inTextFields: false,
    dispatch: pending(175),
  },
  'select-tool': {
    id: 'select-tool',
    label: 'Select',
    shortcuts: [bare('v')],
    inTextFields: false,
    dispatch: pending(175),
  },
  'hand-tool': {
    id: 'hand-tool',
    label: 'Hand',
    shortcuts: [bare('h')],
    inTextFields: false,
    dispatch: pending(175),
  },
  'actor-tool': {
    id: 'actor-tool',
    label: 'Actor',
    shortcuts: [bare('a')],
    inTextFields: false,
    dispatch: adds('actor'),
  },
  'process-tool': {
    id: 'process-tool',
    label: 'Process',
    shortcuts: [bare('p')],
    inTextFields: false,
    dispatch: adds('process'),
  },
  'store-tool': {
    id: 'store-tool',
    label: 'Store',
    shortcuts: [bare('s')],
    inTextFields: false,
    dispatch: adds('store'),
  },
  'boundary-box-tool': {
    id: 'boundary-box-tool',
    label: 'Trust boundary',
    shortcuts: [bare('b')],
    inTextFields: false,
    dispatch: adds('boundary-box'),
  },
  'boundary-curve-tool': {
    id: 'boundary-curve-tool',
    label: 'Trust boundary curve',
    shortcuts: [bare('c')],
    inTextFields: false,
    dispatch: adds('boundary-curve'),
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

/**
 * Which tool command each kind the palette adds belongs to, so a control that
 * adds an element shows the shortcut that adds the same one. It lives here
 * rather than beside the palette because the canvas knows nothing of
 * commands and the registry is what pairs the two.
 */
export const paletteCommands = {
  actor: 'actor-tool',
  process: 'process-tool',
  store: 'store-tool',
  'boundary-box': 'boundary-box-tool',
  'boundary-curve': 'boundary-curve-tool',
} as const satisfies Record<PaletteKind, CommandId>;

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
