import { panoptesYamlCodec } from '@panoptes/formats';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo } from 'react';
import { Action } from '../store/actions.js';
import { isDirty } from '../store/selectors.js';
import { initialState } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  mainDiagram,
  newProcess,
  sampleModel,
} from '../store/store.fixtures.js';
import {
  CommandSurfaceProvider,
  unmountedSurface,
} from '../commands/binding.js';
import { SaveOutcome } from './bridge.js';
import { FileBar } from './file-bar.js';
import { useFileSession } from './file-commands.js';
import {
  chosenFile,
  specBridge,
  vendoredFile,
  type SpecBridge,
} from './files.fixtures.js';

const nativeText = panoptesYamlCodec.write(sampleModel).output;

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

const openControl = (): HTMLElement =>
  screen.getByRole('button', { name: 'Open a model' });

const saveControl = (): HTMLElement =>
  screen.getByRole('button', { name: 'Save' });

const saveAsControl = (): HTMLElement =>
  screen.getByRole('button', { name: 'Save as Threat Dragon JSON' });

const state = (): string => screen.getByTestId('file-state').textContent ?? '';

const reportEntries = (): readonly Element[] => [
  ...screen.getByTestId('loss-report').querySelectorAll('li'),
];

function Bar({ bridge }: { readonly bridge: SpecBridge }) {
  const session = useFileSession(bridge);
  const surface = useMemo(
    () => ({ ...unmountedSurface, files: session.commands }),
    [session.commands],
  );
  return (
    <CommandSurfaceProvider surface={surface}>
      <FileBar session={session} />
    </CommandSurfaceProvider>
  );
}

const mounted = (bridge: SpecBridge): void => {
  render(<Bar bridge={bridge} />);
};

const asked = (): boolean =>
  !globalThis.dispatchEvent(new Event('beforeunload', { cancelable: true }));

/**
 * Écluse, carrying two keys the Threat Dragon wire schema does not declare:
 * one at the root and one under `detail`. Written as text rather than
 * through a parse and a re-stringify, so the file reaches the codec as a
 * file would.
 */
const withUndeclaredKeys = async (): Promise<string> =>
  (await vendoredFile('test-data/ecluse.json').text())
    .replace(
      '"version"',
      '"unknownRoot": "nothing declares this",\n  "version"',
    )
    .replace('"detail": {', '"detail": {\n    "unknownDetail": "nor this",');

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

describe('what the studio says about the file', () => {
  it('names the file, its format, and whether it holds everything on screen', () => {
    mounted(specBridge());

    expect(state()).toBe('No file, Panoptes YAML, no unsaved changes');

    edit();

    expect(state()).toBe('No file, Panoptes YAML, unsaved changes');
  });

  it('guards the tab while the model has changes in no file, and lets go once they are in one', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    expect(asked()).toBe(false);

    edit();

    expect(asked()).toBe(true);

    await user.click(saveControl());

    await waitFor(() => {
      expect(asked()).toBe(false);
    });
  });
});

describe('opening', () => {
  it('puts the model a file carries into the store', async () => {
    const user = userEvent.setup();
    mounted(specBridge({ offers: chosenFile('model.yaml', nativeText) }));

    await user.click(openControl());

    await waitFor(() => {
      expect(state()).toBe('model.yaml, Panoptes YAML, no unsaved changes');
    });
  });

  it('asks before losing changes that are in no file, and opens nothing when refused', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    const bridge = specBridge({ offers: chosenFile('model.yaml', nativeText) });
    mounted(bridge);
    edit();

    await user.click(openControl());

    expect(globalThis.confirm).toHaveBeenCalledTimes(1);
    expect(state()).toBe('No file, Panoptes YAML, unsaved changes');
  });

  it('surfaces what the codec refused, with the paths it carries, rather than stopping', async () => {
    const user = userEvent.setup();
    mounted(
      specBridge({
        offers: chosenFile(
          'broken.json',
          '{"version":"2.0","summary":{"title":"Broken"},"detail":{"diagrams":[{"id":0}]}}',
        ),
      }),
    );

    await user.click(openControl());

    await waitFor(() => {
      expect(screen.getByTestId('failure-notice').textContent).toContain(
        'broken.json is not a valid document',
      );
    });
    expect(screen.getByTestId('failure-notice').textContent).toContain(
      'detail.diagrams.0',
    );
  });

  it('opens the file its own input produced', async () => {
    const bridge = specBridge();
    mounted(bridge);

    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [chosenFile('model.yaml', nativeText)] },
    });

    await waitFor(() => {
      expect(state()).toBe('model.yaml, Panoptes YAML, no unsaved changes');
    });
  });

  it('says what the read dropped, which no later save can report', async () => {
    const user = userEvent.setup();
    const bridge = specBridge({
      offers: chosenFile('ecluse.json', await withUndeclaredKeys()),
    });
    mounted(bridge);

    await user.click(openControl());

    await waitFor(() => {
      expect(reportEntries().length > 0).toBe(true);
    });
    expect(screen.getByTestId('loss-report').textContent).toContain(
      'Opening the file dropped',
    );
    expect(reportEntries().map((entry) => entry.textContent)).toEqual([
      'model: the key unknownRoot (not declared by the wire schema)',
      'model: the key detail.unknownDetail (not declared by the wire schema)',
    ]);

    await user.click(saveControl());

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(1);
    });
    expect(bridge.writes[0].text).not.toContain('unknownRoot');
    expect(reportEntries()).toEqual([]);
  });

  it('changes nothing when the picker is dismissed', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    await user.click(openControl());

    await waitFor(() => {
      expect(state()).toBe('No file, Panoptes YAML, no unsaved changes');
    });
    expect(screen.getByTestId('failure-notice').textContent).toBe('');
    expect(reportEntries()).toEqual([]);
  });

  it('leaves the report standing when the next open is refused, nothing having crossed', async () => {
    const user = userEvent.setup();
    mounted(
      specBridge({
        offers: chosenFile('ecluse.json', await withUndeclaredKeys()),
      }),
    );
    await user.click(openControl());
    await waitFor(() => {
      expect(reportEntries().length > 0).toBe(true);
    });

    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [chosenFile('notes.txt', 'no threat model here')] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('failure-notice').textContent).toContain(
        'No format claimed notes.txt.',
      );
    });
    expect(reportEntries().length > 0).toBe(true);
  });

  it('opens through its own file input where the bridge has no picker', async () => {
    const user = userEvent.setup();
    const clicks = vi.spyOn(HTMLInputElement.prototype, 'click');
    mounted(specBridge({ picker: false }));

    await user.click(openControl());

    await waitFor(() => {
      expect(clicks).toHaveBeenCalledTimes(1);
    });
  });
});

describe('saving', () => {
  it('writes the model through the codec and marks it saved', async () => {
    const user = userEvent.setup();
    const bridge = specBridge();
    mounted(bridge);
    edit();

    await user.click(saveControl());

    await waitFor(() => {
      expect(isDirty(modelStore.getState())).toBe(false);
    });
    expect(bridge.writes).toHaveLength(1);
    expect(bridge.writes[0].name).toBe('threat-model.yaml');
    expect(bridge.writes[0].elsewhere).toBe(false);
    expect(bridge.writes[0].text).toContain('formatVersion');
  });

  it('reports what the format it was asked for could not hold, and puts the report away again', async () => {
    const user = userEvent.setup();
    const bridge = specBridge();
    mounted(bridge);

    await user.click(saveAsControl());

    await waitFor(() => {
      expect(reportEntries().length > 0).toBe(true);
    });
    expect(bridge.writes[0].name).toBe('threat-model.json');
    expect(bridge.writes[0].elsewhere).toBe(true);

    await user.click(
      screen.getByRole('button', { name: 'Dismiss the report' }),
    );

    expect(reportEntries()).toEqual([]);
  });

  it('says nothing of a save the person dismissed', async () => {
    const user = userEvent.setup();
    mounted(specBridge({ save: SaveOutcome.Cancelled() }));
    edit();

    await user.click(saveControl());

    await waitFor(() => {
      expect(isDirty(modelStore.getState())).toBe(true);
    });
    expect(reportEntries()).toEqual([]);
  });
});
