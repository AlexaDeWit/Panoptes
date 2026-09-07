import {
  OpenOutcome,
  SaveOutcome,
  type FileBridge,
  type FileContent,
  type SaveFileType,
} from './bridge.js';
import { chosenFile, deferred, handleFor, settled } from './files.fixtures.js';

const types: readonly SaveFileType[] = [
  {
    description: 'Saerskriven YAML',
    accept: { 'application/yaml': ['.yaml', '.yml'] },
  },
  {
    description: 'Threat Dragon JSON',
    accept: { 'application/json': ['.json'] },
  },
];

const inTheFormatOf = (name: string): string =>
  name.endsWith('.json') ? '{}' : 'a: 1';

const downloads: string[] = [];

const dismissal = (): DOMException =>
  new DOMException('The user dismissed the picker.', 'AbortError');

const freshBridge = async (): Promise<FileBridge> => {
  vi.resetModules();
  return (await import('./browser-bridge.js')).browserFileBridge;
};

beforeEach(() => {
  downloads.length = 0;
  URL.createObjectURL = () => 'blob:model';
  URL.revokeObjectURL = () => undefined;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
    function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('opening', () => {
  it.each(['open', 'save'] as const)(
    'does not release a newer open when an older %s fails',
    async (older) => {
      const failure = deferred<void>();
      const success = deferred<string>();
      const written: FileContent[] = [];
      const picker = vi
        .fn<() => Promise<ReturnType<typeof handleFor>[]>>()
        .mockResolvedValueOnce([
          handleFor('original.yaml', 'a: 1', [], () => failure.promise),
        ]);
      vi.stubGlobal('showOpenFilePicker', picker);
      const bridge = await freshBridge();
      await settled(bridge.open(1024));
      if (older === 'open') {
        picker.mockResolvedValueOnce([
          {
            ...handleFor('failed.yaml', '', []),
            getFile: () =>
              Promise.resolve({
                ...chosenFile('failed.yaml', ''),
                text: () => failure.promise.then(() => ''),
              }),
          },
        ]);
      }
      const failed = (
        older === 'open'
          ? bridge.open(1024)
          : bridge.save('original.yaml', 'b: 2')
      ).then((result) => result.settle(false));
      picker.mockResolvedValueOnce([
        {
          ...handleFor('replacement.yaml', 'a: 1', written),
          getFile: () =>
            Promise.resolve({
              ...chosenFile('replacement.yaml', 'a: 1'),
              text: () => success.promise,
            }),
        },
      ]);
      const opened = bridge.open(1024).then((result) => result.settle(true));
      failure.reject(new Error('NotAllowedError'));
      success.resolve('a: 1');
      expect(await Promise.all([failed, opened])).toEqual([false, true]);
      await settled(bridge.save('replacement.yaml', 'b: 2'));
      expect(written).toEqual(['b: 2']);
      expect(downloads).toEqual([]);
    },
  );

  it('asks the caller for its own picker where the browser has none', async () => {
    const bridge = await freshBridge();

    expect(await settled(bridge.open(1024))).toEqual(OpenOutcome.NoPicker());
  });

  it('reads the file the picker handed over', async () => {
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.yaml', 'a: 1', [])]),
    );
    const bridge = await freshBridge();

    expect(await settled(bridge.open(1024))).toEqual(
      OpenOutcome.Chosen({ name: 'model.yaml', text: 'a: 1' }),
    );
  });

  it('says nothing where the picker was dismissed', async () => {
    vi.stubGlobal('showOpenFilePicker', () => Promise.reject(dismissal()));
    const bridge = await freshBridge();

    expect(await settled(bridge.open(1024))).toEqual(OpenOutcome.Cancelled());
  });

  it('reports what the picker refused with', async () => {
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.reject(new Error('NotAllowedError')),
    );
    const bridge = await freshBridge();

    expect(await settled(bridge.open(1024))).toEqual(
      OpenOutcome.Unreadable({ reason: 'NotAllowedError' }),
    );
  });

  it('says nothing where the picker handed nothing over', async () => {
    vi.stubGlobal('showOpenFilePicker', () => Promise.resolve([]));
    const bridge = await freshBridge();

    expect(await settled(bridge.open(1024))).toEqual(OpenOutcome.Cancelled());
  });
});

describe('saving', () => {
  it('writes back to the very file that was opened', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.yaml', 'a: 1', written)]),
    );
    const bridge = await freshBridge();
    await settled(bridge.open(1024));

    expect(await settled(bridge.save('proposed.yaml', 'b: 2'))).toEqual(
      SaveOutcome.Written({ name: 'model.yaml' }),
    );
    expect(written).toEqual(['b: 2']);
  });

  it('reports a write the platform refused', async () => {
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([
        {
          name: 'model.yaml',
          getFile: () => Promise.resolve(chosenFile('model.yaml', 'a: 1')),
          createWritable: () => Promise.reject(new Error('NotAllowedError')),
        },
      ]),
    );
    const bridge = await freshBridge();
    await settled(bridge.open(1024));

    expect(await settled(bridge.save('model.yaml', 'b: 2'))).toEqual(
      SaveOutcome.Refused({ reason: 'NotAllowedError' }),
    );
  });

  it('offers a download where the file the picker named would not read', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('huge.json', 'a'.repeat(100), written)]),
    );
    const bridge = await freshBridge();

    expect((await settled(bridge.open(10)))._tag).toBe('TooLarge');
    expect(await settled(bridge.save('threat-model.yaml', 'a: 1'))).toEqual(
      SaveOutcome.Written({ name: 'threat-model.yaml' }),
    );
    expect(written).toEqual([]);
    expect(downloads).toEqual(['threat-model.yaml']);
  });

  it('offers a download where no file was opened through a picker', async () => {
    const bridge = await freshBridge();

    expect(await settled(bridge.save('threat-model.yaml', 'a: 1'))).toEqual(
      SaveOutcome.Written({ name: 'threat-model.yaml' }),
    );
    expect(downloads).toEqual(['threat-model.yaml']);
  });

  it('writes where a save-as asked, and a later save follows it there', async () => {
    const written: string[] = [];
    vi.stubGlobal('showSaveFilePicker', () =>
      Promise.resolve(handleFor('chosen.yaml', '', written)),
    );
    const bridge = await freshBridge();

    expect(
      await settled(bridge.saveAs('proposed.yaml', types, inTheFormatOf)),
    ).toEqual(SaveOutcome.Written({ name: 'chosen.yaml' }));
    await settled(bridge.save('proposed.yaml', 'second'));

    expect(written).toEqual(['a: 1', 'second']);
  });

  it('offers every format, and writes the one the name it came back with is in', async () => {
    const written: string[] = [];
    const asked: unknown[] = [];
    vi.stubGlobal('showSaveFilePicker', (options: unknown) => {
      asked.push(options);
      return Promise.resolve(handleFor('chosen.json', '', written));
    });
    const bridge = await freshBridge();

    expect(
      await settled(bridge.saveAs('proposed.yaml', types, inTheFormatOf)),
    ).toEqual(SaveOutcome.Written({ name: 'chosen.json' }));

    expect(asked).toEqual([{ suggestedName: 'proposed.yaml', types }]);
    expect(written).toEqual(['{}']);
  });

  it('keeps writing back to the open file when a save-as is refused where it was pointed', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.json', '{}', written)]),
    );
    vi.stubGlobal('showSaveFilePicker', () =>
      Promise.resolve({
        name: 'elsewhere.json',
        createWritable: () => Promise.reject(new Error('NotAllowedError')),
      }),
    );
    const bridge = await freshBridge();
    await settled(bridge.open(1024));

    expect(
      await settled(bridge.saveAs('elsewhere.json', types, inTheFormatOf)),
    ).toEqual(SaveOutcome.Refused({ reason: 'NotAllowedError' }));
    await settled(bridge.save('model.json', 'second'));

    expect(written).toEqual(['second']);
    expect(downloads).toEqual([]);
  });

  it('says nothing where a save-as was dismissed, and keeps writing back to the open file', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.json', '{}', written)]),
    );
    vi.stubGlobal('showSaveFilePicker', () => Promise.reject(dismissal()));
    const bridge = await freshBridge();
    await settled(bridge.open(1024));

    expect(
      await settled(bridge.saveAs('model.yaml', types, inTheFormatOf)),
    ).toEqual(SaveOutcome.Cancelled());
    await settled(bridge.save('model.json', 'second'));

    expect(written).toEqual(['second']);
    expect(downloads).toEqual([]);
  });

  it('says it cannot ask where, and downloads the format it was handed, on a browser with no save picker', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.json', '{}', written)]),
    );
    const bridge = await freshBridge();
    await settled(bridge.open(1024));

    expect(bridge.asksWhere()).toBe(false);
    expect(
      await settled(bridge.saveAs('model.yaml', types, inTheFormatOf)),
    ).toEqual(SaveOutcome.Written({ name: 'model.yaml' }));
    await settled(bridge.save('model.yaml', 'a: 1'));

    expect(written).toEqual([]);
    expect(downloads).toEqual(['model.yaml', 'model.yaml']);
  });

  it('says it can ask where wherever the browser has that picker', async () => {
    vi.stubGlobal('showSaveFilePicker', () =>
      Promise.resolve(handleFor('chosen.yaml', '', [])),
    );
    const bridge = await freshBridge();

    expect(bridge.asksWhere()).toBe(true);
  });

  it('forgets it too when the caller opened through its own file input', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.json', '{}', written)]),
    );
    const bridge = await freshBridge();
    await settled(bridge.open(1024));

    await settled(bridge.received(chosenFile('other.yaml', 'a: 1'), 1024));
    await settled(bridge.save('other.yaml', 'a: 1'));

    expect(written).toEqual([]);
    expect(downloads).toEqual(['other.yaml']);
  });

  it('forgets it when the file is released, so a later save writes nowhere near it', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.json', '{}', written)]),
    );
    const bridge = await freshBridge();
    await settled(bridge.open(1024));

    bridge.release();
    await settled(bridge.save('threat-model.yaml', 'a: 1'));

    expect(written).toEqual([]);
    expect(downloads).toEqual(['threat-model.yaml']);
  });

  it.each(['picker', 'input'] as const)(
    'downloads after the session releases a refused %s open',
    async (path) => {
      const original: FileContent[] = [];
      const rejected: FileContent[] = [];
      const picker = vi
        .fn<() => Promise<ReturnType<typeof handleFor>[]>>()
        .mockResolvedValueOnce([handleFor('model.yaml', 'a: 1', original)])
        .mockResolvedValueOnce([
          handleFor('notes.txt', 'not a model', rejected),
        ]);
      vi.stubGlobal('showOpenFilePicker', picker);
      const bridge = await freshBridge();
      await settled(bridge.open(1024));

      const result =
        path === 'picker'
          ? await bridge.open(1024)
          : await bridge.received(chosenFile('notes.txt', 'not a model'), 1024);
      expect(result.outcome._tag).toBe('Chosen');

      expect(result.settle(false)).toBe(true);
      expect(await settled(bridge.save('threat-model.yaml', 'b: 2'))).toEqual(
        SaveOutcome.Written({ name: 'threat-model.yaml' }),
      );
      expect(original).toEqual([]);
      expect(rejected).toEqual([]);
      expect(downloads).toEqual(['threat-model.yaml']);
    },
  );
});

describe('exporting', () => {
  it('writes text through the picker without replacing the open file', async () => {
    const opened: FileContent[] = [];
    const exported: FileContent[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.yaml', 'a: 1', opened)]),
    );
    vi.stubGlobal('showSaveFilePicker', () =>
      Promise.resolve(handleFor('model.svg', '', exported)),
    );
    const bridge = await freshBridge();
    await settled(bridge.open(1024));

    expect(await bridge.exportFile('model.svg', types[0], '<svg/>')).toEqual(
      SaveOutcome.Written({ name: 'model.svg' }),
    );
    await settled(bridge.save('model.yaml', 'second'));

    expect(exported).toEqual(['<svg/>']);
    expect(opened).toEqual(['second']);
  });

  it('downloads binary content under the proposed name without a picker', async () => {
    const bridge = await freshBridge();
    const pdf = new Uint8Array([37, 80, 68, 70]);

    expect(await bridge.exportFile('Untitled.pdf', types[0], pdf)).toEqual(
      SaveOutcome.Written({ name: 'Untitled.pdf' }),
    );
    expect(downloads).toEqual(['Untitled.pdf']);
  });

  it('reports a refused export picker and treats its dismissal as no write', async () => {
    vi.stubGlobal('showSaveFilePicker', () =>
      Promise.reject(new Error('NotAllowedError')),
    );
    const bridge = await freshBridge();

    expect(await bridge.exportFile('model.svg', types[0], '<svg/>')).toEqual(
      SaveOutcome.Refused({ reason: 'NotAllowedError' }),
    );

    vi.stubGlobal('showSaveFilePicker', () => Promise.reject(dismissal()));

    expect(await bridge.exportFile('model.svg', types[0], '<svg/>')).toEqual(
      SaveOutcome.Cancelled(),
    );
  });
});
