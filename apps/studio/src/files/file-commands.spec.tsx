import { panoptesYamlCodec } from '@panoptes/formats';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  mainDiagram,
  newProcess,
  sampleModel,
} from '../store/store.fixtures.js';
import { useFileSession } from './file-commands.js';
import { chosenFile, specBridge, type SpecBridge } from './files.fixtures.js';

const nativeText = panoptesYamlCodec.write(sampleModel).output;

const session = (bridge: SpecBridge) =>
  renderHook(() => useFileSession(bridge)).result;

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
  it('holds one set of commands, so a control and a key press run the same three', () => {
    const result = session(specBridge());
    const first = result.current.commands;

    edit();

    expect(result.current.commands).toBe(first);
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

  it('saves elsewhere in the format the file is not already in', async () => {
    const bridge = specBridge();
    const result = session(bridge);

    act(() => {
      result.current.commands.saveAs();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(1);
    });
    expect(bridge.writes[0].name).toBe('threat-model.json');
    expect(bridge.writes[0].elsewhere).toBe(true);
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

  it('holds what the last crossing cost until it is put away', async () => {
    const result = session(
      specBridge({ offers: chosenFile('model.yaml', nativeText) }),
    );

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
