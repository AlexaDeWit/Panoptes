import { saerskrivenYamlCodec } from '@saerskriven/formats';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Either } from 'effect';
import { Action } from '../store/actions.js';
import { isDirty } from '../store/selectors.js';
import { initialState } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  mainDiagram,
  newProcess,
  sampleModel,
} from '../store/store.fixtures.js';
import { browserFileBridge } from './browser-bridge.js';
import { useFileSession } from './file-commands.js';
import {
  chosenFile,
  deferred,
  handleFor,
  specBridge,
  vendoredFile,
} from './files.fixtures.js';
import type { FileContent } from './bridge.js';

beforeEach(() => {
  browserFileBridge.release();
  modelStore.setState(initialState(sampleModel), true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('imports through the fallback picker and saves a dirty native model', async () => {
  const bridge = specBridge({ picker: false });
  const { result } = renderHook(() => useFileSession(bridge));
  const input = document.createElement('input');
  const click = vi.spyOn(input, 'click');
  act(() => {
    result.current.attachPicker(input);
    result.current.commands.import();
  });
  await waitFor(() => {
    expect(click).toHaveBeenCalledOnce();
  });
  await act(() =>
    result.current.receive(vendoredFile('test-data/otm/example.json')),
  );
  expect(isDirty(modelStore.getState())).toBe(true);
  expect(modelStore.getState().file).toMatchObject({
    name: 'example.yaml',
    source: { format: 'saerskriven-yaml', document: undefined },
  });
  expect(result.current.report?.occasion).toBe('import');
  act(() => {
    result.current.commands.save();
  });
  await waitFor(() => {
    expect(bridge.writes).toHaveLength(1);
  });
  expect(bridge.writes[0].name).toBe('example.yaml');
  expect(Either.isRight(saerskrivenYamlCodec.read(bridge.writes[0].text))).toBe(
    true,
  );
  expect(isDirty(modelStore.getState())).toBe(false);
});

it('asks before replacing edited work and allows cancellation', async () => {
  const bridge = specBridge({
    offers: vendoredFile('test-data/otm/example.json'),
  });
  const open = vi.spyOn(bridge, 'open');
  const { result } = renderHook(() => useFileSession(bridge));
  act(() => {
    dispatch(
      Action.AddElement({
        diagramId: mainDiagram,
        element: newProcess('new-process', 'New'),
      }),
    );
    result.current.commands.import();
  });
  expect(result.current.importing).toBe(true);
  expect(open).not.toHaveBeenCalled();
  act(() => {
    result.current.cancelImport();
  });
  expect(result.current.importing).toBe(false);
  expect(modelStore.getState().present.metadata.title).toBe(
    sampleModel.metadata.title,
  );
  act(() => {
    result.current.commands.import();
    result.current.confirmImport();
  });
  await waitFor(() => {
    expect(result.current.report?.occasion).toBe('import');
  });
});

it('releases the imported source handle and keeps the existing handle after a failed import', async () => {
  const original: FileContent[] = [];
  const source: FileContent[] = [];
  const native = saerskrivenYamlCodec.write(sampleModel).output;
  const picker = vi
    .fn<() => Promise<ReturnType<typeof handleFor>[]>>()
    .mockResolvedValueOnce([handleFor('original.yaml', native, original)])
    .mockResolvedValueOnce([
      handleFor('invalid.otm', 'otmVersion: 0.2.0', source),
    ])
    .mockResolvedValueOnce([
      handleFor(
        'source.otm',
        await vendoredFile('test-data/otm/example.json').text(),
        source,
      ),
    ]);
  vi.stubGlobal('showOpenFilePicker', picker);
  const { result } = renderHook(() => useFileSession(browserFileBridge));
  act(() => {
    result.current.commands.open();
  });
  await waitFor(() => {
    expect(modelStore.getState().file).toMatchObject({ name: 'original.yaml' });
  });
  act(() => {
    result.current.commands.import();
  });
  await waitFor(() => {
    expect(modelStore.getState().lastFailure?._tag).toBe('Read');
  });
  act(() => {
    result.current.commands.save();
  });
  await waitFor(() => {
    expect(original).toHaveLength(1);
  });
  expect(source).toEqual([]);
  act(() => {
    result.current.commands.import();
  });
  await waitFor(() => {
    expect(modelStore.getState().file).toMatchObject({ name: 'source.yaml' });
  });
  const download = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  act(() => {
    result.current.commands.save();
  });
  await waitFor(() => {
    expect(download).toHaveBeenCalledOnce();
  });
  expect(original).toHaveLength(1);
  expect(source).toEqual([]);
});

it('ignores a late import when a newer open already owns the session', async () => {
  const pending = deferred<string>();
  const bridge = specBridge({
    offers: { ...chosenFile('slow.otm', ''), text: () => pending.promise },
  });
  const { result } = renderHook(() => useFileSession(bridge));
  act(() => {
    result.current.commands.import();
  });
  await act(() =>
    result.current.receive(
      chosenFile('new.yaml', saerskrivenYamlCodec.write(sampleModel).output),
    ),
  );
  await act(async () => {
    pending.resolve(await vendoredFile('test-data/otm/example.json').text());
  });
  expect(modelStore.getState().file).toMatchObject({ name: 'new.yaml' });
  expect(result.current.report).toBeUndefined();
});
