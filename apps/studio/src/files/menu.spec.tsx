import { saerskrivenYamlCodec } from '@saerskriven/formats';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo } from 'react';
import {
  CommandSurfaceProvider,
  unmountedSurface,
} from '../commands/binding.js';
import { Action } from '../store/actions.js';
import { isDirty } from '../store/selectors.js';
import { initialState, placeholderModel } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  actorElement,
  mainDiagram,
  nativeSource,
  newNote,
  newProcess,
  sampleModel,
} from '../store/store.fixtures.js';
import { SaveOutcome } from './bridge.js';
import { useFileSession } from './file-commands.js';
import { nameOf } from './session.js';
import {
  chosenFile,
  specBridge,
  vendoredFile,
  type SpecBridge,
} from './files.fixtures.js';
import { StudioMenu } from './menu.js';

const nativeText = saerskrivenYamlCodec.write(sampleModel).output;

type User = ReturnType<typeof userEvent.setup>;

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

const burger = (): HTMLElement =>
  screen.getByRole('button', { name: /^Menu/u });

const item = (name: string | RegExp): HTMLElement =>
  screen.getByRole('menuitem', { name });

const openMenu = async (user: User): Promise<void> => {
  if (screen.queryByRole('menu') === null) {
    await user.click(burger());
    await screen.findByRole('menu');
  }
};

const choose = async (user: User, name: string | RegExp): Promise<void> => {
  await openMenu(user);
  await user.click(item(name));
};

const state = (): string => screen.getByTestId('file-state').textContent ?? '';

const shown = async (user: User): Promise<string> => {
  await openMenu(user);
  return state();
};

const reportEntries = (): readonly Element[] => [
  ...screen.getByTestId('loss-report').querySelectorAll('li'),
];

function Menu({ bridge }: { readonly bridge: SpecBridge }) {
  const session = useFileSession(bridge);
  const surface = useMemo(
    () => ({ ...unmountedSurface, files: session.commands }),
    [session.commands],
  );
  return (
    <CommandSurfaceProvider surface={surface}>
      <StudioMenu session={session} />
    </CommandSurfaceProvider>
  );
}

const mounted = (bridge: SpecBridge): void => {
  render(<Menu bridge={bridge} />);
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

describe('what the menu offers', () => {
  it('holds the file commands and the edit commands, in two named groups', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    await openMenu(user);

    expect(
      screen.getAllByRole('menuitem').map((entry) => entry.textContent),
    ).toEqual([
      'Open a modelCtrl+O',
      'SaveCtrl+S',
      'Save asCtrl+Shift+S',
      'Close the fileCtrl+Shift+X',
      'UndoCtrl+Z',
      'RedoCtrl+Shift+Z or Ctrl+Y',
      'Rename the selectionF2',
      'Delete the selectionDelete or Backspace',
    ]);
    expect(
      screen.getAllByRole('group').map((group) => group.textContent),
    ).toContain(
      'FileOpen a modelCtrl+OSaveCtrl+SSave asCtrl+Shift+SClose the fileCtrl+Shift+X',
    );
  });

  it('keeps the shortcut out of an item name, and names the binding as ARIA asks', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    await openMenu(user);

    expect(item('Save').getAttribute('aria-keyshortcuts')).toBe('Control+S');
  });

  it('marks unsaved work on the button, in words as well as with the dot', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    expect(burger().getAttribute('aria-label')).toBe('Menu');

    edit();

    expect(burger().getAttribute('aria-label')).toBe('Menu, unsaved changes');

    expect(await shown(user)).toBe(
      'Untitled, Saerskriven YAML, unsaved changes',
    );
  });

  it('offers a history move only once there is one to make', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    await openMenu(user);

    expect(item('Undo').getAttribute('data-disabled')).not.toBeNull();

    edit();

    expect(item('Undo').getAttribute('data-disabled')).toBeNull();
    expect(item('Redo').getAttribute('data-disabled')).not.toBeNull();

    await choose(user, 'Undo');
    await openMenu(user);

    expect(item('Redo').getAttribute('data-disabled')).toBeNull();
  });
});

describe('what the studio says about the file', () => {
  it('offers a command on the selection only once there is one', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    await openMenu(user);
    expect(
      item('Rename the selection').getAttribute('data-disabled'),
    ).not.toBeNull();
    expect(
      item('Delete the selection').getAttribute('data-disabled'),
    ).not.toBeNull();

    act(() => {
      dispatch(Action.Select({ elementId: actorElement }));
    });

    expect(
      item('Rename the selection').getAttribute('data-disabled'),
    ).toBeNull();
    expect(
      item('Delete the selection').getAttribute('data-disabled'),
    ).toBeNull();
  });

  it('offers no rename over a text note, which draws prose rather than a name', async () => {
    const user = userEvent.setup();
    const note = newNote('text-note', 'The studio opens on this model.');
    mounted(specBridge());
    act(() => {
      dispatch(Action.AddElement({ diagramId: mainDiagram, element: note }));
      dispatch(Action.Select({ elementId: note.id }));
    });

    await openMenu(user);

    expect(
      item('Rename the selection').getAttribute('data-disabled'),
    ).not.toBeNull();
    expect(
      item('Delete the selection').getAttribute('data-disabled'),
    ).toBeNull();
  });

  it('opens the name of the selection in a field, from the menu', async () => {
    const user = userEvent.setup();
    mounted(specBridge());
    act(() => {
      dispatch(Action.Select({ elementId: actorElement }));
    });

    await choose(user, 'Rename the selection');

    expect(modelStore.getState().renaming).toBe(actorElement);
  });

  it('names the file, its format, and whether it holds everything on screen', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    expect(await shown(user)).toBe(
      'Untitled, Saerskriven YAML, no unsaved changes',
    );
  });

  it('guards the tab while the model has changes in no file, and lets go once they are in one', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    expect(asked()).toBe(false);

    edit();

    expect(asked()).toBe(true);

    await choose(user, 'Save');

    await waitFor(() => {
      expect(asked()).toBe(false);
    });
  });
});

describe('opening', () => {
  it('puts the model a file carries into the store', async () => {
    const user = userEvent.setup();
    mounted(specBridge({ offers: chosenFile('model.yaml', nativeText) }));

    await choose(user, 'Open a model');

    await waitFor(() => {
      expect(nameOf(modelStore.getState().file)).toBe('model.yaml');
    });
    expect(await shown(user)).toBe(
      'model.yaml, Saerskriven YAML, no unsaved changes',
    );
  });

  it('asks before losing changes that are in no file, and opens nothing when refused', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    mounted(specBridge({ offers: chosenFile('model.yaml', nativeText) }));
    edit();

    await choose(user, 'Open a model');

    expect(globalThis.confirm).toHaveBeenCalledTimes(1);
    expect(await shown(user)).toBe(
      'Untitled, Saerskriven YAML, unsaved changes',
    );
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

    await choose(user, 'Open a model');

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
    const user = userEvent.setup();
    mounted(specBridge());

    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [chosenFile('model.yaml', nativeText)] },
    });
    await openMenu(user);

    await waitFor(() => {
      expect(state()).toBe('model.yaml, Saerskriven YAML, no unsaved changes');
    });
  });

  it('says what the read dropped, which no later save can report', async () => {
    const user = userEvent.setup();
    const bridge = specBridge({
      offers: chosenFile('ecluse.json', await withUndeclaredKeys()),
    });
    mounted(bridge);

    await choose(user, 'Open a model');

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

    await choose(user, 'Save');

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(1);
    });
    expect(bridge.writes[0].text).not.toContain('unknownRoot');
    expect(reportEntries()).toEqual([]);
  });

  it('changes nothing when the picker is dismissed', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    await choose(user, 'Open a model');

    expect(await shown(user)).toBe(
      'Untitled, Saerskriven YAML, no unsaved changes',
    );
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
    await choose(user, 'Open a model');
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

    await choose(user, 'Open a model');

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

    await choose(user, 'Save');

    await waitFor(() => {
      expect(isDirty(modelStore.getState())).toBe(false);
    });
    expect(bridge.writes).toHaveLength(1);
    expect(bridge.writes[0].name).toBe('threat-model.yaml');
    expect(bridge.writes[0].elsewhere).toBe(false);
    expect(bridge.writes[0].text).toContain('formatVersion');
  });

  it('places the file in its own format, through the picker the platform offers', async () => {
    const user = userEvent.setup();
    const bridge = specBridge();
    mounted(bridge);

    await choose(user, 'Save as');

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(1);
    });
    expect(bridge.writes[0].name).toBe('threat-model.yaml');
    expect(bridge.writes[0].elsewhere).toBe(true);
    expect(await shown(user)).toBe(
      'threat-model.yaml, Saerskriven YAML, no unsaved changes',
    );
  });

  it('asks the format in the menu where the platform has no picker, and takes the question back', async () => {
    const user = userEvent.setup();
    const bridge = specBridge({ picker: false });
    mounted(bridge);

    await choose(user, 'Save as');

    await screen.findByRole('menuitem', { name: 'Save as Saerskriven YAML' });
    expect(
      screen.getAllByRole('menuitem').map((entry) => entry.textContent),
    ).toEqual([
      'Open a modelCtrl+O',
      'SaveCtrl+S',
      'Save as Saerskriven YAML',
      'Save as Threat Dragon JSON',
      'Close the fileCtrl+Shift+X',
      'UndoCtrl+Z',
      'RedoCtrl+Shift+Z or Ctrl+Y',
      'Rename the selectionF2',
      'Delete the selectionDelete or Backspace',
    ]);
    expect(bridge.writes).toEqual([]);

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null);
    });
    await openMenu(user);

    expect(item('Save as')).toBeDefined();
  });

  it('reports what the format it was asked for could not hold, and puts the report away again', async () => {
    const user = userEvent.setup();
    const bridge = specBridge({ picker: false });
    mounted(bridge);

    await choose(user, 'Save as');
    await screen.findByRole('menuitem', { name: 'Save as Threat Dragon JSON' });
    await user.click(item('Save as Threat Dragon JSON'));

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

    await choose(user, 'Save');

    await waitFor(() => {
      expect(isDirty(modelStore.getState())).toBe(true);
    });
    expect(reportEntries()).toEqual([]);
  });
});

describe('closing', () => {
  it('closes at once while there is nothing to lose', async () => {
    const user = userEvent.setup();
    mounted(specBridge({ offers: chosenFile('model.yaml', nativeText) }));
    await choose(user, 'Open a model');
    await waitFor(() => {
      expect(nameOf(modelStore.getState().file)).toBe('model.yaml');
    });

    await choose(user, 'Close the file');

    expect(modelStore.getState().present).toBe(placeholderModel);
    expect(await shown(user)).toBe(
      'Untitled, Saerskriven YAML, no unsaved changes',
    );
  });

  it('asks in the menu rather than in a dialog, and puts it away when the file is kept', async () => {
    const user = userEvent.setup();
    const bridge = specBridge();
    mounted(bridge);
    edit();

    await choose(user, 'Close the file');

    expect(item('Discard the changes and close')).toBeDefined();
    expect(globalThis.confirm).toHaveBeenCalledTimes(0);

    await user.click(item('Keep the file open'));

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null);
    });
    expect(isDirty(modelStore.getState())).toBe(true);
    expect(bridge.releases.count).toBe(0);

    await openMenu(user);

    expect(item('Close the file')).toBeDefined();
  });

  it('closes on the second step, dropping the changes it warned about', async () => {
    const user = userEvent.setup();
    mounted(specBridge());
    edit();

    await choose(user, 'Close the file');
    await user.click(item('Discard the changes and close'));

    expect(modelStore.getState().present).toBe(placeholderModel);
    expect(await shown(user)).toBe(
      'Untitled, Saerskriven YAML, no unsaved changes',
    );
  });

  it('opens the menu on the question when the chord asks with the menu shut', async () => {
    const user = userEvent.setup();
    mounted(specBridge());
    edit();

    await user.keyboard('{Control>}{Shift>}X{/Shift}{/Control}');

    expect(
      await screen.findByRole('menuitem', {
        name: 'Discard the changes and close',
      }),
    ).toBeDefined();
    expect(isDirty(modelStore.getState())).toBe(true);
  });

  it('takes the question back when a save lands under it', async () => {
    const user = userEvent.setup();
    mounted(specBridge());
    edit();

    await choose(user, 'Close the file');

    expect(item('Discard the changes and close')).toBeDefined();

    act(() => {
      dispatch(Action.Saved({ name: 'model.yaml', source: nativeSource }));
    });

    expect(
      screen.queryByRole('menuitem', {
        name: 'Discard the changes and close',
      }),
    ).toBe(null);
    expect(item('Close the file')).toBeDefined();
  });

  it('takes the question back when the menu is dismissed', async () => {
    const user = userEvent.setup();
    mounted(specBridge());
    edit();

    await choose(user, 'Close the file');
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null);
    });

    await openMenu(user);

    expect(item('Close the file')).toBeDefined();
  });
});
