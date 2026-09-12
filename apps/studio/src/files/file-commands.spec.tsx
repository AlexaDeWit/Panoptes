import { readLimits, saerskrivenYamlCodec } from '@saerskriven/formats';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Action } from '../store/actions.js';
import {
  FileLifecycle,
  initialState,
  placeholderModel,
} from '../store/state.js';
import { isDirty } from '../store/selectors.js';
import { dispatch, modelStore } from '../store/store.js';
import type { StoreSync, SyncedState } from '../store/sync.js';
import {
  mainDiagram,
  newProcess,
  sampleModel,
} from '../store/store.fixtures.js';
import type { RenderExports } from './export-commands.js';
import {
  SaveOutcome,
  type ChosenFile,
  type FileBridge,
  type FileContent,
} from './bridge.js';
import { browserFileBridge } from './browser-bridge.js';
import { useFileSession } from './file-commands.js';
import {
  chosenFile,
  deferred,
  handleFor,
  specBridge,
  specRenders,
} from './files.fixtures.js';

const nativeText = saerskrivenYamlCodec.write(sampleModel).output;
const downloads: string[] = [];

const failedFiles: readonly ChosenFile[] = [
  { ...chosenFile('large.yaml', ''), size: readLimits.maxTextBytes + 1 },
  {
    ...chosenFile('unreadable.yaml', ''),
    text: () => Promise.reject(new Error('The file was moved.')),
  },
  chosenFile('notes.txt', 'not a model'),
];

const session = (
  bridge: FileBridge,
  renders?: RenderExports,
  sync?: Pick<StoreSync, 'watch'>,
) => renderHook(() => useFileSession(bridge, renders, sync)).result;

function anotherTab() {
  let follow: ((state: SyncedState) => void) | undefined;
  return {
    sync: {
      watch: (next: (state: SyncedState) => void) => {
        follow = next;
        return () => undefined;
      },
    },
    reaches: (state: SyncedState) => {
      act(() => {
        follow?.(state);
      });
    },
  };
}

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
  browserFileBridge.release();
  downloads.length = 0;
  vi.stubGlobal(
    'URL',
    class extends URL {
      static override createObjectURL(): string {
        return 'blob:model';
      }
      static override revokeObjectURL(): void {}
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
    function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    },
  );
  modelStore.setState(initialState(sampleModel), true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useFileSession', () => {
  describe.each(['open', 'fallback', 'save'] as const)(
    'a failed %s beside a successful Open',
    (older) => {
      it.each([
        ['failure first', 'native'],
        ['success first', 'native'],
        ['failure first', 'fallback'],
        ['success first', 'fallback'],
      ] as const)(
        'keeps the newer file when callbacks finish %s (%s)',
        async (order, newer) => {
          const failure = deferred<void>();
          const success = deferred<string>();
          const original: FileContent[] = [];
          const replacement: FileContent[] = [];
          const text = vi.fn<() => Promise<string>>(() => success.promise);
          const picker = vi
            .fn<() => Promise<ReturnType<typeof handleFor>[]>>()
            .mockResolvedValueOnce([
              handleFor(
                'original.yaml',
                nativeText,
                original,
                () => failure.promise,
              ),
            ]);
          vi.stubGlobal('showOpenFilePicker', picker);
          const result = session(browserFileBridge);
          await act(() => {
            result.current.commands.open();
            return Promise.resolve();
          });
          edit();
          if (older === 'open') {
            picker.mockResolvedValueOnce([
              {
                ...handleFor('failed.yaml', nativeText, []),
                getFile: () =>
                  Promise.resolve({
                    ...chosenFile('failed.yaml', nativeText),
                    text: () => failure.promise.then(() => nativeText),
                  }),
              },
            ]);
          }
          act(() => {
            if (older === 'fallback') {
              void result.current.receive({
                ...chosenFile('failed.yaml', nativeText),
                text: () => failure.promise.then(() => nativeText),
              });
            } else {
              result.current.commands[older]();
              if (older === 'open') {
                result.current.confirmOpen();
              }
            }
          });
          picker.mockResolvedValueOnce([
            {
              ...handleFor('replacement.yaml', nativeText, replacement),
              getFile: () =>
                Promise.resolve({
                  ...chosenFile('replacement.yaml', nativeText),
                  text,
                }),
            },
          ]);
          act(() => {
            if (newer === 'fallback') {
              void result.current.receive({
                ...chosenFile('replacement.yaml', nativeText),
                text,
              });
            } else {
              result.current.commands.open();
              result.current.confirmOpen();
            }
          });
          await waitFor(() => {
            expect(text).toHaveBeenCalledTimes(1);
          });
          await act(async () => {
            if (order === 'failure first') {
              failure.reject(new Error('NotAllowedError'));
              success.resolve(nativeText);
            } else {
              success.resolve(nativeText);
              failure.reject(new Error('NotAllowedError'));
            }
            await Promise.allSettled([failure.promise, success.promise]);
          });
          expect(modelStore.getState().file).toMatchObject({
            _tag: 'Opened',
            name: 'replacement.yaml',
          });
          expect(modelStore.getState().lastFailure).toBeUndefined();
          await act(() => {
            result.current.commands.save();
            return Promise.resolve();
          });
          expect(replacement).toHaveLength(newer === 'native' ? 1 : 0);
          expect(downloads).toEqual(
            newer === 'native' ? [] : ['replacement.yaml'],
          );
        },
      );
    },
  );

  it.each(['save', 'saveAs'] as const)(
    'retries a refused %s through the original handle',
    async (command) => {
      const written: FileContent[] = [];
      const original = handleFor('original.yaml', nativeText, written);
      const elsewhere = handleFor('elsewhere.yaml', nativeText, []);
      vi.stubGlobal('showOpenFilePicker', () => Promise.resolve([original]));
      vi.stubGlobal('showSaveFilePicker', () => Promise.resolve(elsewhere));
      const result = session(browserFileBridge);
      await act(() => {
        result.current.commands.open();
        return Promise.resolve();
      });
      edit();
      const before = modelStore.getState();
      vi.spyOn(
        command === 'save' ? original : elsewhere,
        'createWritable',
      ).mockRejectedValueOnce(new Error('NotAllowedError'));
      await act(() => {
        result.current.commands[command]();
        return Promise.resolve();
      });
      expect(modelStore.getState().file).toBe(before.file);
      expect(modelStore.getState().lastFailure?._tag).toBe('File');
      expect(isDirty(modelStore.getState())).toBe(true);
      await act(() => {
        result.current.commands.save();
        return Promise.resolve();
      });
      expect(written).toHaveLength(1);
      expect(downloads).toEqual([]);
      expect(isDirty(modelStore.getState())).toBe(false);
    },
  );

  describe.each(['save', 'saveAs'] as const)('an overlapping %s', (command) => {
    it.each([
      'picker refusal',
      'codec refusal',
      'successful open',
      'cancelled open',
      'close',
      'newer save',
      'newer save-as',
      'stale write refusal',
      'save finishes first',
    ] as const)('keeps the association consistent after %s', async (change) => {
      const writes: Record<string, FileContent[]> = {
        'original.yaml': [],
        'elsewhere.yaml': [],
        'replacement.yaml': [],
      };
      let finish: (() => void) | undefined;
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
      close.mockImplementationOnce(() =>
        pending.then(() =>
          change === 'stale write refusal'
            ? Promise.reject(new Error('NotAllowedError'))
            : undefined,
        ),
      );
      const original = handleFor(
        'original.yaml',
        nativeText,
        writes['original.yaml'],
        command === 'save' ? close : undefined,
      );
      const elsewhere = handleFor(
        'elsewhere.yaml',
        nativeText,
        writes['elsewhere.yaml'],
        command === 'saveAs' ? close : undefined,
      );
      const replacement = handleFor(
        'replacement.yaml',
        nativeText,
        writes['replacement.yaml'],
      );
      const picker = vi
        .fn<() => Promise<ReturnType<typeof handleFor>[]>>()
        .mockResolvedValueOnce([original])
        .mockResolvedValue([replacement]);
      vi.stubGlobal('showOpenFilePicker', picker);
      vi.stubGlobal('showSaveFilePicker', () => Promise.resolve(elsewhere));
      const result = session(browserFileBridge);
      await act(() => {
        result.current.commands.open();
        return Promise.resolve();
      });
      edit();
      act(() => {
        result.current.commands[command]();
      });
      await waitFor(() => {
        expect(close).toHaveBeenCalledTimes(1);
      });

      if (change === 'save finishes first') {
        await act(async () => {
          finish?.();
          await pending;
        });
      }
      await act(async () => {
        switch (change) {
          case 'codec refusal': {
            await result.current.receive(
              chosenFile('notes.txt', 'not a model'),
            );
            break;
          }
          case 'close': {
            result.current.confirmClose();
            break;
          }
          case 'newer save': {
            result.current.commands.save();
            break;
          }
          case 'newer save-as': {
            vi.stubGlobal('showSaveFilePicker', () =>
              Promise.resolve(replacement),
            );
            result.current.commands.saveAs();
            break;
          }
          case 'picker refusal':
            picker.mockRejectedValueOnce(new Error('NotAllowedError'));
            result.current.commands.open();
            result.current.confirmOpen();
            break;
          case 'save finishes first': {
            picker.mockRejectedValueOnce(new Error('NotAllowedError'));
            result.current.commands.open();
            break;
          }
          case 'cancelled open': {
            picker.mockRejectedValueOnce(
              new DOMException('Dismissed', 'AbortError'),
            );
            result.current.commands.open();
            result.current.confirmOpen();
            break;
          }
          case 'successful open':
          case 'stale write refusal': {
            result.current.commands.open();
            result.current.confirmOpen();
          }
        }
      });
      const later = modelStore.getState();
      await act(async () => {
        finish?.();
        await pending;
      });

      expect(modelStore.getState().present).toBe(later.present);
      expect(modelStore.getState().saved).toBe(later.saved);
      expect(modelStore.getState().lastFailure).toBe(later.lastFailure);
      const destination =
        change === 'cancelled open'
          ? 'original.yaml'
          : change === 'successful open' ||
              change === 'stale write refusal' ||
              change === 'newer save-as'
            ? 'replacement.yaml'
            : change === 'newer save'
              ? 'original.yaml'
              : 'threat-model.yaml';
      expect(modelStore.getState().file).toMatchObject(
        destination === 'threat-model.yaml'
          ? FileLifecycle.NoFile()
          : { _tag: 'Opened', name: destination },
      );
      const counts = Object.fromEntries(
        Object.entries(writes).map(([name, values]) => [name, values.length]),
      );
      await act(() => {
        result.current.commands.save();
        return Promise.resolve();
      });

      expect(downloads).toEqual(
        destination === 'threat-model.yaml' ? [destination] : [],
      );
      for (const [name, values] of Object.entries(writes)) {
        expect(values).toHaveLength(
          counts[name] + (name === destination ? 1 : 0),
        );
      }
      expect(modelStore.getState().file).toMatchObject({
        _tag: 'Opened',
        name: destination,
      });
    });
  });

  describe.each(['read first', 'save first'] as const)(
    'a fallback selection and Save As complete %s',
    (order) => {
      it.each(['chosen', 'unreadable', 'refused', 'cancelled'] as const)(
        'keeps the next Save target consistent when the selection is %s',
        async (outcome) => {
          const original: FileContent[] = [];
          const elsewhere: FileContent[] = [];
          let finishRead: (() => void) | undefined;
          const readPending = new Promise<void>((resolve) => {
            finishRead = resolve;
          });
          let finishSave: (() => void) | undefined;
          const savePending = new Promise<void>((resolve) => {
            finishSave = resolve;
          });
          const close = vi.fn<() => Promise<void>>(() => savePending);
          vi.stubGlobal('showOpenFilePicker', () =>
            Promise.resolve([handleFor('original.yaml', nativeText, original)]),
          );
          vi.stubGlobal('showSaveFilePicker', () =>
            Promise.resolve(
              handleFor('elsewhere.yaml', nativeText, elsewhere, close),
            ),
          );
          const result = session(browserFileBridge);
          await act(() => {
            result.current.commands.open();
            return Promise.resolve();
          });
          edit();
          const file = {
            ...chosenFile('replacement.yaml', nativeText),
            text: () =>
              readPending.then(() =>
                outcome === 'unreadable'
                  ? Promise.reject(new Error('NotAllowedError'))
                  : outcome === 'refused'
                    ? 'not a model'
                    : nativeText,
              ),
          };
          const reading = result.current.receive(
            outcome === 'cancelled' ? undefined : file,
          );
          act(() => {
            result.current.commands.saveAs();
          });
          await waitFor(() => {
            expect(close).toHaveBeenCalledTimes(1);
          });

          for (const readFirst of order === 'read first'
            ? [true, false]
            : [false, true]) {
            await act(async () => {
              if (readFirst) {
                finishRead?.();
                await reading;
              } else {
                finishSave?.();
                await savePending;
              }
            });
          }

          const name = 'elsewhere.yaml';
          expect(modelStore.getState().file).toMatchObject({
            _tag: 'Opened',
            name,
          });
          expect(elsewhere).toHaveLength(1);
          await act(() => {
            result.current.commands.save();
            return Promise.resolve();
          });

          expect(downloads).toEqual([]);
          expect(original).toEqual([]);
          expect(elsewhere).toHaveLength(2);
          expect(modelStore.getState().file).toMatchObject({
            _tag: 'Opened',
            name,
          });
        },
      );
    },
  );

  it('holds one command set for controls and key presses', () => {
    const result = session(specBridge());
    const first = result.current.commands;

    edit();

    expect(result.current.commands).toBe(first);
  });

  it('routes every registered export through the export session', async () => {
    const bridge = specBridge();
    const result = session(bridge, specRenders());

    act(() => {
      result.current.commands.exportDiagram(mainDiagram);
      result.current.commands.exportRegister();
      result.current.commands.exportTypst();
      result.current.commands.exportPdf();
      result.current.commands.exportPng();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(5);
    });
    expect(bridge.writes.map((write) => write.name)).toEqual([
      'Untitled.svg',
      'Untitled.md',
      'Untitled.typ',
      'Untitled.pdf',
      'Untitled.png',
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

  it('suppresses a stale fallback click after Close', async () => {
    const clicks = vi.spyOn(HTMLInputElement.prototype, 'click');
    const result = session(specBridge({ picker: false }));
    result.current.attachPicker(document.createElement('input'));

    await act(() => {
      result.current.commands.open();
      result.current.commands.close();
      return Promise.resolve();
    });

    expect(clicks).not.toHaveBeenCalled();
    expect(modelStore.getState().present).toBe(placeholderModel);
  });

  it('keeps an older read active when the Save As format menu is cancelled', async () => {
    const pending = deferred<string>();
    const result = session(browserFileBridge);
    const reading = result.current.receive({
      ...chosenFile('replacement.yaml', nativeText),
      text: () => pending.promise,
    });
    act(() => {
      result.current.commands.saveAs();
    });
    expect(result.current.choosing).toBe(true);

    act(() => {
      result.current.cancelChoice();
    });
    await act(async () => {
      pending.resolve(nativeText);
      await reading;
    });

    expect(result.current.choosing).toBe(false);
    expect(modelStore.getState().file).toMatchObject({
      _tag: 'Opened',
      name: 'replacement.yaml',
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
            result.current.confirmOpen();
          } else {
            await result.current.receive(file);
          }
        });

        await waitFor(() => {
          expect(modelStore.getState().lastFailure).toBeDefined();
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
    'retains a refused %s without losing unsaved work',
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
        expect(modelStore.getState().lastFailure).toBeDefined();
      });
      const after = modelStore.getState();
      expect(after.file).toBe(before.file);
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

  it('lets the bridge go of the file it was holding once another tab reaches a result, and puts its question away', () => {
    const other = anotherTab();
    const bridge = specBridge();
    const result = session(bridge, undefined, other.sync);
    edit();
    act(() => {
      result.current.commands.close();
    });
    expect(result.current.closing).toBe(true);

    other.reaches({ ...initialState(placeholderModel), recoveryCurrent: true });

    expect(bridge.releases.count).toBe(1);
    expect(result.current.closing).toBe(false);
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

  it('holds an open until the question over unsaved work is answered', async () => {
    const result = session(
      specBridge({ offers: chosenFile('model.yaml', nativeText) }),
    );
    edit();
    const before = modelStore.getState().present;

    act(() => {
      result.current.commands.open();
    });

    expect(result.current.opening).toBe(true);
    expect(modelStore.getState().present).toBe(before);

    await act(async () => {
      result.current.confirmOpen();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(modelStore.getState().file).toMatchObject({
        _tag: 'Opened',
        name: 'model.yaml',
      });
    });
    expect(result.current.opening).toBe(false);
  });
});
