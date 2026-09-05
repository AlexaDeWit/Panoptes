import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { recordingSurface } from './commands.fixtures.js';
import {
  commandById,
  commandFor,
  commands,
  paletteCommands,
  runCommand,
  type CommandId,
} from './registry.js';
import { platforms, spellChord } from './shortcuts.js';

const chordsOn = (platform: (typeof platforms)[number]): string[] =>
  commands.flatMap((command) =>
    command.shortcuts.map((chord) => spellChord(chord, platform)),
  );

describe('the command registry', () => {
  it('gives every command a shortcut', () => {
    expect(
      commands.filter((command) => command.shortcuts.length === 0),
    ).toEqual([]);
  });

  it('gives no two commands the same chord, on either platform', () => {
    for (const platform of platforms) {
      const chords = chordsOn(platform);
      expect(new Set(chords).size).toBe(chords.length);
    }
  });

  it('files every command under its own id', () => {
    for (const command of commands) {
      expect(commandById(command.id)).toBe(command);
    }
  });

  it('exempts only saving and the history moves from a control being typed in', () => {
    expect(
      commands
        .filter((command) => command.inTextFields)
        .map((command) => command.id),
    ).toEqual(['save', 'save-as', 'undo', 'redo']);
  });

  it('leaves Escape to the field a refused draft is being corrected in', () => {
    expect(commandById('clear-selection').inTextFields).toBe(false);
  });

  it('names the issue that will give each command still without a dispatch one', () => {
    const waiting = commands.filter(
      (command) => command.dispatch.kind === 'pending',
    );
    expect(
      waiting.map((command) => [
        command.id,
        command.dispatch.kind === 'pending' ? command.dispatch.issue : 0,
      ]),
    ).toEqual([
      ['close-file', 174],
      ['select-all', 156],
      ['start-flow', 175],
      ['select-tool', 175],
      ['hand-tool', 175],
    ]);
  });

  it('binds each kind the palette adds to a tool command of its own', () => {
    const bound = Object.values(paletteCommands);
    expect(new Set(bound).size).toBe(bound.length);
    for (const id of bound) {
      expect(commandById(id).dispatch.kind).toBe('runs');
    }
  });
});

describe('commandFor', () => {
  it('finds the command a press names, and nothing where none does', () => {
    const press = {
      key: 'z',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
    };
    expect(commandFor(press, 'other')?.id).toBe('undo');
    expect(commandFor({ ...press, shiftKey: true }, 'other')?.id).toBe('redo');
    expect(commandFor({ ...press, key: 'q' }, 'other')).toBeUndefined();
  });
});

describe('runCommand', () => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
  });

  it('asks the surface for the commands it answers for', () => {
    const recording = recordingSurface();
    const asked: CommandId[] = [
      'open',
      'save',
      'save-as',
      'zoom-in',
      'fit-to-view',
    ];

    for (const id of asked) {
      runCommand(commandById(id), recording.surface);
    }

    expect(recording.asked).toEqual([
      'open',
      'save',
      'saveAs',
      'zoomIn',
      'fitToView',
    ]);
  });

  it('dispatches an edit against the store', () => {
    const recording = recordingSurface();

    runCommand(commandById('actor-tool'), recording.surface);

    expect(modelStore.getState().present.diagrams[0].elements).toHaveLength(3);
    expect(recording.asked).toEqual([]);
  });

  it('does nothing at all for a command still waiting on its surface', () => {
    const recording = recordingSurface();
    const before = modelStore.getState();

    runCommand(commandById('select-all'), recording.surface);
    runCommand(commandById('hand-tool'), recording.surface);

    expect(modelStore.getState()).toBe(before);
    expect(recording.asked).toEqual([]);
  });
});
