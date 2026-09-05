import { OpenOutcome, SaveOutcome, type FileBridge } from './bridge.js';
import { chosenFile } from './files.fixtures.js';

const downloads: string[] = [];

const handleFor = (name: string, text: string, written: string[]) => ({
  name,
  getFile: () => Promise.resolve(chosenFile(name, text)),
  createWritable: () =>
    Promise.resolve({
      write: (chunk: string) => {
        written.push(chunk);
        return Promise.resolve();
      },
      close: () => Promise.resolve(),
    }),
});

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
  it('asks the caller for its own picker where the browser has none', async () => {
    const bridge = await freshBridge();

    expect(await bridge.open(1024)).toEqual(OpenOutcome.NoPicker());
  });

  it('reads the file the picker handed over', async () => {
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.yaml', 'a: 1', [])]),
    );
    const bridge = await freshBridge();

    expect(await bridge.open(1024)).toEqual(
      OpenOutcome.Chosen({ name: 'model.yaml', text: 'a: 1' }),
    );
  });

  it('says nothing where the picker was dismissed', async () => {
    vi.stubGlobal('showOpenFilePicker', () => Promise.reject(dismissal()));
    const bridge = await freshBridge();

    expect(await bridge.open(1024)).toEqual(OpenOutcome.Cancelled());
  });

  it('reports what the picker refused with', async () => {
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.reject(new Error('NotAllowedError')),
    );
    const bridge = await freshBridge();

    expect(await bridge.open(1024)).toEqual(
      OpenOutcome.Unreadable({ reason: 'NotAllowedError' }),
    );
  });

  it('says nothing where the picker handed nothing over', async () => {
    vi.stubGlobal('showOpenFilePicker', () => Promise.resolve([]));
    const bridge = await freshBridge();

    expect(await bridge.open(1024)).toEqual(OpenOutcome.Cancelled());
  });
});

describe('saving', () => {
  it('writes back to the very file that was opened', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.yaml', 'a: 1', written)]),
    );
    const bridge = await freshBridge();
    await bridge.open(1024);

    expect(await bridge.save('proposed.yaml', 'b: 2')).toEqual(
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
    await bridge.open(1024);

    expect(await bridge.save('model.yaml', 'b: 2')).toEqual(
      SaveOutcome.Refused({ reason: 'NotAllowedError' }),
    );
  });

  it('offers a download where no file was opened through a picker', async () => {
    const bridge = await freshBridge();

    expect(await bridge.save('threat-model.yaml', 'a: 1')).toEqual(
      SaveOutcome.Written({ name: 'threat-model.yaml' }),
    );
    expect(downloads).toEqual(['threat-model.yaml']);
  });

  it('writes where a save-as asked, and a later save follows it there', async () => {
    const written: string[] = [];
    vi.stubGlobal('showSaveFilePicker', () =>
      Promise.resolve(handleFor('chosen.json', '', written)),
    );
    const bridge = await freshBridge();

    expect(await bridge.saveAs('proposed.json', 'first')).toEqual(
      SaveOutcome.Written({ name: 'chosen.json' }),
    );
    await bridge.save('proposed.json', 'second');

    expect(written).toEqual(['first', 'second']);
  });

  it('says nothing where a save-as was dismissed', async () => {
    vi.stubGlobal('showSaveFilePicker', () => Promise.reject(dismissal()));
    const bridge = await freshBridge();

    expect(await bridge.saveAs('model.yaml', 'a: 1')).toEqual(
      SaveOutcome.Cancelled(),
    );
  });

  it('forgets the file the model came from once a save-as downloads instead', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.json', '{}', written)]),
    );
    const bridge = await freshBridge();
    await bridge.open(1024);

    await bridge.saveAs('model.yaml', 'a: 1');
    await bridge.save('model.yaml', 'a: 1');

    expect(written).toEqual([]);
    expect(downloads).toEqual(['model.yaml', 'model.yaml']);
  });

  it('forgets it too when the caller opened through its own file input', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.json', '{}', written)]),
    );
    const bridge = await freshBridge();
    await bridge.open(1024);

    await bridge.received(chosenFile('other.yaml', 'a: 1'), 1024);
    await bridge.save('other.yaml', 'a: 1');

    expect(written).toEqual([]);
    expect(downloads).toEqual(['other.yaml']);
  });
});
