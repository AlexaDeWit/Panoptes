import { readLimits, saerskrivenYamlCodec } from '@saerskriven/formats';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Either } from 'effect';
import { Action } from '../store/actions.js';
import {
  FileLifecycle,
  initialState,
  placeholderModel,
} from '../store/state.js';
import { isDirty } from '../store/selectors.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  mainDiagram,
  newProcess,
  sampleModel,
} from '../store/store.fixtures.js';
import type { PdfExport } from './export-commands.js';
import { SaveOutcome, type ChosenFile } from './bridge.js';
import { useFileSession } from './file-commands.js';
import { chosenFile, specBridge, type SpecBridge } from './files.fixtures.js';

const nativeText = saerskrivenYamlCodec.write(sampleModel).output;

const failedFiles: readonly ChosenFile[] = [
  { ...chosenFile('large.yaml', ''), size: readLimits.maxTextBytes + 1 },
  {
    ...chosenFile('unreadable.yaml', ''),
    text: () => Promise.reject(new Error('The file was moved.')),
  },
  chosenFile('notes.txt', 'not a model'),
];

const session = (bridge: SpecBridge, pdf?: PdfExport) =>
  renderHook(() => useFileSession(bridge, pdf)).result;

const edit = (): void => {
  act(() => {
    dispatch(
      Action.AddElement({
        diagramId: mainDiagram,
        element: newProcess('process-added', 'Added'),
      }),
    );
  });
};

beforeEach(() => {
  modelStore.setState(initialState(sampleModel), true);
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useFileSession', () => {
  it('holds one command set for controls and key presses', () => {
    const result = session(specBridge());
    const first = result.current.commands;

    edit();

    expect(result.current.commands).toBe(first);
  });

  it('routes every registered export through the export session', async () => {
    const bridge = specBridge();
    const result = session(bridge, {
      assets: () =>
        Promise.resolve(Either.right({ wasm: new Uint8Array(), fonts: [] })),
      compile: () => Promise.resolve(Either.right(new Uint8Array([37, 80]))),
    });

    act(() => {
      result.current.commands.exportDiagram(mainDiagram);
      result.current.commands.exportRegister();
      result.current.commands.exportTypst();
      result.current.commands.exportPdf();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(4);
    });
    expect(bridge.writes.map((write) => write.name)).toEqual([
      'Untitled.svg',
      'Untitled.md',
      'Untitled.typ',
      'Untitled.pdf',
    ]);
  });

  it('reads the model and the file as the command runs, not as it was built', async () => {
    const bridge = specBridge();
    const result = session(bridge);

    edit();
    act(() => {
      result.current.commands.save();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(1);
    });
    expect(bridge.writes[0].text).toContain('Added');
  });

  it('places the file in the format it is already in, offering the picker every one', async () => {
    const bridge = specBridge();
    const result = session(bridge);

    act(() => {
      result.current.commands.saveAs();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(1);
    });
    expect(bridge.writes[0].name).toBe('threat-model.yaml');
    expect(bridge.writes[0].elsewhere).toBe(true);
    expect(bridge.offered[0].map((type) => type.description)).toEqual([
      'Saerskriven YAML',
      'Threat Dragon JSON',
    ]);
  });

  it('writes through the codec the name the picker came back with names, and saves there after', async () => {
    const bridge = specBridge({ chooses: 'chosen.json' });
    const result = session(bridge);

    act(() => {
      result.current.commands.saveAs();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(1);
    });
    expect(bridge.writes[0].name).toBe('chosen.json');
    expect(bridge.writes[0].text).toContain('"version"');

    act(() => {
      result.current.commands.save();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(2);
    });
    expect(bridge.writes[1]).toMatchObject({
      name: 'chosen.json',
      elsewhere: false,
    });
  });

  it('writes a name in no registered format in the one the file is already in', async () => {
    const bridge = specBridge({ chooses: 'notes.txt' });
    const result = session(bridge);

    act(() => {
      result.current.commands.saveAs();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(1);
    });
    expect(bridge.writes[0].name).toBe('notes.txt');
    expect(bridge.writes[0].text).toContain('formatVersion');

    act(() => {
      result.current.commands.save();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(2);
    });
    expect(bridge.writes[1]).toMatchObject({
      name: 'notes.txt',
      elsewhere: false,
    });
  });

  it('asks the format itself where the bridge has no picker to ask it in', async () => {
    const bridge = specBridge({ picker: false });
    const result = session(bridge);

    expect(result.current.asksFormat).toBe(true);

    act(() => {
      result.current.commands.saveAs();
    });

    expect(result.current.choosing).toBe(true);
    expect(bridge.writes).toEqual([]);

    act(() => {
      result.current.chooseFormat('threat-dragon');
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(1);
    });
    expect(bridge.writes[0]).toMatchObject({
      name: 'threat-model.json',
      elsewhere: true,
    });
    expect(result.current.choosing).toBe(false);
  });

  it('opens through the fallback picker where the bridge has none of its own', async () => {
    const clicks = vi.spyOn(HTMLInputElement.prototype, 'click');
    const result = session(specBridge({ picker: false }));
    result.current.attachPicker(document.createElement('input'));

    act(() => {
      result.current.commands.open();
    });

    await waitFor(() => {
      expect(clicks).toHaveBeenCalledTimes(1);
    });
  });

  describe.each(['picker', 'input'] as const)('a failed %s open', (path) => {
    it.each(failedFiles)(
      'releases the file but keeps the work when $name fails',
      async (file) => {
        const bridge = specBridge({ offers: file });
        const result = session(bridge);
        await act(async () => {
          await result.current.receive(chosenFile('model.yaml', nativeText));
        });
        edit();
        const before = modelStore.getState();

        await act(async () => {
          if (path === 'picker') {
            result.current.commands.open();
          } else {
            await result.current.receive(file);
          }
        });

        await waitFor(() => {
          expect(bridge.releases.count).toBe(1);
        });
        const after = modelStore.getState();
        expect(after.file).toEqual(FileLifecycle.NoFile());
        expect(after.present).toBe(before.present);
        expect(after.past).toBe(before.past);
        expect(after.future).toBe(before.future);
        expect(after.saved).toBe(before.saved);
        expect(after.lastFailure).toBeDefined();
        expect(isDirty(after)).toBe(true);

        act(() => {
          result.current.commands.save();
        });

        await waitFor(() => {
          expect(bridge.writes).toHaveLength(1);
        });
        expect(bridge.writes[0]).toMatchObject({
          name: 'threat-model.yaml',
          text: saerskrivenYamlCodec.write(before.present).output,
        });
        expect(modelStore.getState().file).toMatchObject({
          _tag: 'Opened',
          name: 'threat-model.yaml',
        });
      },
    );
  });

  it.each(['save', 'saveAs'] as const)(
    'releases a refused %s without losing unsaved work',
    async (command) => {
      const bridge = specBridge({
        save: SaveOutcome.Refused({ reason: 'The folder is read only.' }),
      });
      const result = session(bridge);
      await act(async () => {
        await result.current.receive(chosenFile('model.yaml', nativeText));
      });
      edit();
      const before = modelStore.getState();

      act(() => {
        result.current.commands[command]();
      });

      await waitFor(() => {
        expect(bridge.releases.count).toBe(1);
      });
      const after = modelStore.getState();
      expect(after.file).toEqual(FileLifecycle.NoFile());
      expect(after.present).toBe(before.present);
      expect(after.saved).toBe(before.saved);
      expect(after.past).toBe(before.past);
      expect(after.future).toBe(before.future);
      expect(isDirty(after)).toBe(true);
      expect(bridge.writes).toEqual([]);
    },
  );

  it('keeps the file association when an open is cancelled', async () => {
    const bridge = specBridge();
    const result = session(bridge);
    await act(async () => {
      await result.current.receive(chosenFile('model.yaml', nativeText));
    });
    const before = modelStore.getState();

    await act(async () => {
      result.current.commands.open();
      await result.current.receive(undefined);
    });

    expect(modelStore.getState()).toBe(before);
    expect(bridge.releases.count).toBe(0);
  });

  it('holds what the last crossing cost until it is put away', async () => {
    const result = session(specBridge({ chooses: 'model.json' }));

    act(() => {
      result.current.commands.saveAs();
    });

    await waitFor(() => {
      expect(result.current.report?.occasion).toBe('save');
    });

    act(() => {
      result.current.dismissReport();
    });

    expect(result.current.report).toBeUndefined();
  });

  it('lets the bridge go of the file it was holding once the file is closed', () => {
    const bridge = specBridge();
    const result = session(bridge);

    act(() => {
      result.current.commands.close();
    });

    expect(bridge.releases.count).toBe(1);
    expect(modelStore.getState().present).toBe(placeholderModel);
  });

  it('holds the file until the question over unsaved work is answered', () => {
    const bridge = specBridge();
    const result = session(bridge);
    edit();

    act(() => {
      result.current.commands.close();
    });

    expect(result.current.closing).toBe(true);
    expect(bridge.releases.count).toBe(0);

    act(() => {
      result.current.confirmClose();
    });

    expect(bridge.releases.count).toBe(1);
    expect(modelStore.getState().present).toBe(placeholderModel);
  });

  it('leaves the model alone when the person refuses to lose work in no file', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    const result = session(
      specBridge({ offers: chosenFile('model.yaml', nativeText) }),
    );
    edit();
    const before = modelStore.getState().present;

    act(() => {
      result.current.commands.open();
    });

    await waitFor(() => {
      expect(globalThis.confirm).toHaveBeenCalledTimes(1);
    });
    expect(modelStore.getState().present).toBe(before);
  });
});
