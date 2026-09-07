import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { currentTool, resetTools, tools } from '../canvas/tools.js';
import { recordingSurface } from './commands.fixtures.js';
import {
  commandById,
  commandFor,
  commands,
  diagramExportCommand,
  runCommand,
  toolCommands,
  type CommandId,
} from './registry.js';
import { platforms, spellChord } from './shortcuts.js';

const chordsOn = (platform: (typeof platforms)[number]): string[] =>
  commands.flatMap((command) =>
    command.shortcuts.map((chord) => spellChord(chord, platform)),
  );

describe('the command registry', () => {
  it('leaves shortcuts off only the exports issue 190 added without one', () => {
    expect(
      commands
        .filter((command) => command.shortcuts.length === 0)
        .map((command) => command.id),
    ).toEqual([
      'export-diagram',
      'export-register',
      'export-typst',
      'export-pdf',
    ]);
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
    expect(commandById('select-tool').inTextFields).toBe(false);
  });

  it('names the issue for any command still without a dispatch', () => {
    const waiting = commands.filter(
      (command) => command.dispatch.kind === 'pending',
    );
    expect(
      waiting.map((command) => [
        command.id,
        command.dispatch.kind === 'pending' ? command.dispatch.issue : 0,
      ]),
    ).toEqual([]);
  });

  it('binds every toolbox mode to a command of its own', () => {
    const bound = Object.values(toolCommands);
    expect(new Set(bound).size).toBe(bound.length);
    for (const tool of tools) {
      expect(commandById(toolCommands[tool]).dispatch.kind).toBe('runs');
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

  it.each([
    ['1', 'select-tool'],
    ['2', 'actor-tool'],
    ['3', 'process-tool'],
    ['4', 'store-tool'],
    ['5', 'boundary-box-tool'],
    ['6', 'boundary-curve-tool'],
  ] as const)('maps number %s to %s', (key, command) => {
    expect(
      commandFor(
        {
          key,
          ctrlKey: false,
          metaKey: false,
          shiftKey: false,
          altKey: false,
        },
        'other',
      )?.id,
    ).toBe(command);
  });
});

describe('runCommand', () => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
    resetTools();
  });

  it('asks the surface for the commands it answers for', () => {
    const recording = recordingSurface();
    const asked: CommandId[] = [
      'open',
      'save',
      'save-as',
      'export-diagram',
      'export-register',
      'export-typst',
      'export-pdf',
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
      'exportDiagram',
      'exportRegister',
      'exportTypst',
      'exportPdf',
      'zoomIn',
      'fitToView',
    ]);
  });

  it('binds a diagram export to the diagram named by the menu item', () => {
    const recording = recordingSurface();
    const command = diagramExportCommand(placeholderModel.diagrams[0], true);

    runCommand(command, recording.surface);

    expect(command.label).toBe('Diagram as SVG: Untitled diagram');
    expect(recording.asked).toEqual(['exportDiagram']);
  });

  it('selects an element mode without editing the store', () => {
    const recording = recordingSurface();
    const before = modelStore.getState();

    runCommand(commandById('actor-tool'), recording.surface);

    expect(currentTool()).toMatchObject({ active: 'actor', locked: false });
    expect(modelStore.getState()).toBe(before);
    expect(recording.asked).toEqual([]);
  });

  it('selects the diagram through the select-all command', () => {
    const recording = recordingSurface();

    runCommand(commandById('select-all'), recording.surface);

    expect(modelStore.getState().selection).toEqual(
      placeholderModel.diagrams[0].elements.map((element) => element.id),
    );
    expect(modelStore.getState().past).toEqual([]);
    expect(recording.asked).toEqual([]);
  });
});
