import { saerskrivenYamlCodec } from '@saerskriven/formats';
import { emptyModel } from '@saerskriven/model';
import { diagramId } from '@saerskriven/model/fixtures';
import { PdfFailure } from '@saerskriven/render/pdf';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Either } from 'effect';
import { useEffect, useMemo } from 'react';
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
  processElement,
  sampleModel,
} from '../store/store.fixtures.js';
import { SaveOutcome } from './bridge.js';
import type { PdfExport } from './export-commands.js';
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

const openExportMenu = async (user: User): Promise<void> => {
  await openMenu(user);
  await user.hover(item('Export'));
  await screen.findByRole('menuitem', { name: 'Diagram as SVG' });
};

const state = (): string => screen.getByTestId('file-state').textContent ?? '';

const shown = async (user: User): Promise<string> => {
  await openMenu(user);
  return state();
};

const reportEntries = (): readonly Element[] => [
  ...screen.getByTestId('loss-report').querySelectorAll('li'),
];

function Menu({
  bridge,
  exportPdf,
  pdf,
}: {
  readonly bridge: SpecBridge;
  readonly exportPdf?: boolean;
  readonly pdf?: PdfExport;
}) {
  const session = useFileSession(bridge, pdf);
  useEffect(() => {
    if (exportPdf === true) {
      session.commands.exportPdf();
    }
  }, [exportPdf, session.commands]);
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

const mounted = (
  bridge: SpecBridge,
  pdf?: PdfExport,
  exportPdf?: boolean,
): void => {
  render(<Menu bridge={bridge} exportPdf={exportPdf} pdf={pdf} />);
};

const asked = (): boolean =>
  !globalThis.dispatchEvent(new Event('beforeunload', { cancelable: true }));

const withUndeclaredKeys = async (): Promise<string> =>
  (await vendoredFile('test-data/ecluse.json').text())
    .replace(
      '"version"',
      '"unknownRoot": "nothing declares this",\n  "version"',
    )
    .replace('"detail": {', '"detail": {\n    "unknownDetail": "nor this",');

beforeEach(() => {
  modelStore.setState(initialState(sampleModel), true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('what the menu offers', () => {
  it('holds the file commands, edit commands and project link', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    await openMenu(user);

    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(13);
    expect(
      items.filter((entry) => entry.hasAttribute('aria-keyshortcuts')),
    ).toHaveLength(10);
    for (const name of ['Open', 'Save', 'Save as', 'Export', 'New model']) {
      expect(item(name)).toBeDefined();
    }
    expect(items.filter((entry) => entry.hasAttribute('href'))).toHaveLength(1);
  });

  it('links to the source in a new tab with a popout icon', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    await openMenu(user);

    const source = item('View source on GitHub');
    expect(source.getAttribute('href')).toBe(
      'https://github.com/AlexaDeWit/Saerskriven',
    );
    expect(source.getAttribute('target')).toBe('_blank');
    expect(source.getAttribute('rel')).toBe('noopener noreferrer');
    expect(source.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('opens every projection from one Export item', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    await openExportMenu(user);

    expect(
      screen.getAllByRole('menuitem').map((entry) => entry.textContent),
    ).toContain('Diagram as SVG');
    for (const name of [
      'Register as Markdown',
      'Model as Typst',
      'Model as PDF',
    ]) {
      expect(item(name)).toBeDefined();
    }
  });

  it('names each SVG entry from its diagram when the model has several', async () => {
    const user = userEvent.setup();
    modelStore.setState(
      initialState({
        ...sampleModel,
        diagrams: [
          sampleModel.diagrams[0],
          {
            id: diagramId('diagram-other'),
            title: 'Other diagram',
            elements: [],
          },
        ],
      }),
      true,
    );
    mounted(specBridge());

    await openMenu(user);
    await user.hover(item('Export'));

    expect(
      await screen.findByRole('menuitem', {
        name: 'Diagram as SVG: Main',
      }),
    ).toBeDefined();
    expect(item('Diagram as SVG: Other diagram')).toBeDefined();
  });

  it('disables the SVG export when the model holds no diagram', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(emptyModel), true);
    mounted(specBridge());

    await openExportMenu(user);

    expect(item('Diagram as SVG').getAttribute('data-disabled')).not.toBeNull();
  });

  it('announces a PDF compile refusal and writes no file', async () => {
    const user = userEvent.setup();
    const bridge = specBridge();
    mounted(
      bridge,
      {
        assets: () =>
          Promise.resolve(Either.right({ wasm: new Uint8Array(), fonts: [] })),
        compile: () =>
          Promise.resolve(
            Either.left(
              PdfFailure.Refused({ sentences: ['unknown function: nope'] }),
            ),
          ),
      },
      true,
    );

    await waitFor(() => {
      expect(screen.getByTestId('export-report').textContent).toContain(
        'Saerskriven could not compile the PDF.',
      );
    });
    expect(screen.getByTestId('export-report').textContent).toContain(
      'unknown function: nope',
    );
    expect(bridge.writes).toEqual([]);

    await user.click(
      screen.getByRole('button', { name: 'Dismiss export report' }),
    );
    expect(screen.queryByTestId('export-report')).toBeNull();
  });

  it('keeps the shortcut out of an item name, and names the binding as ARIA asks', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    await openMenu(user);

    expect(item('Save').getAttribute('aria-keyshortcuts')).toBe('Control+S');

    await user.hover(item('Export'));
    expect(
      (
        await screen.findByRole('menuitem', { name: 'Register as Markdown' })
      ).getAttribute('aria-keyshortcuts'),
    ).toBeNull();
  });

  it('marks unsaved work on the button, in words as well as with the dot', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    expect(burger().getAttribute('aria-label')).toBe('Menu');

    edit();

    expect(burger().getAttribute('aria-label')).toBe('Menu, unsaved changes');

    expect(await shown(user)).toContain('Saerskriven YAML');
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
      item('Rename selection').getAttribute('data-disabled'),
    ).not.toBeNull();
    expect(item('Focus threats').getAttribute('data-disabled')).not.toBeNull();
    expect(
      item('Delete selection').getAttribute('data-disabled'),
    ).not.toBeNull();

    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement] }));
    });

    expect(item('Rename selection').getAttribute('data-disabled')).toBeNull();
    expect(item('Focus threats').getAttribute('data-disabled')).toBeNull();
    expect(item('Delete selection').getAttribute('data-disabled')).toBeNull();

    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement, processElement] }));
    });

    expect(item('Focus threats').getAttribute('data-disabled')).not.toBeNull();
  });

  it('offers no rename over a text note, which draws prose rather than a name', async () => {
    const user = userEvent.setup();
    const note = newNote('text-note', 'The studio opens on this model.');
    mounted(specBridge());
    act(() => {
      dispatch(Action.AddElement({ diagramId: mainDiagram, element: note }));
      dispatch(Action.Select({ elementIds: [note.id] }));
    });

    await openMenu(user);

    expect(
      item('Rename selection').getAttribute('data-disabled'),
    ).not.toBeNull();
    expect(item('Focus threats').getAttribute('data-disabled')).toBeNull();
    expect(item('Delete selection').getAttribute('data-disabled')).toBeNull();
  });

  it('opens the name of the selection in a field, from the menu', async () => {
    const user = userEvent.setup();
    mounted(specBridge());
    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement] }));
    });

    await choose(user, 'Rename selection');

    expect(modelStore.getState().inlineEditor).toEqual({
      kind: 'name',
      elementId: actorElement,
    });
  });

  it('names the file, its format, and whether it holds everything on screen', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    expect(await shown(user)).toContain('Saerskriven YAML');
    expect(burger().getAttribute('aria-label')).toBe('Menu');
  });

  it('guards the tab only after the latest recovery write fails', () => {
    mounted(specBridge());

    expect(asked()).toBe(false);

    edit();

    expect(asked()).toBe(false);

    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementationOnce(() => {
        throw new DOMException('Quota reached', 'QuotaExceededError');
      });
    act(() => {
      dispatch(
        Action.RenameElement({
          elementId: actorElement,
          name: 'Changed once',
        }),
      );
    });

    expect(asked()).toBe(true);
    expect(screen.getByTestId('failure-notice').textContent).toContain(
      'Local recovery is unavailable.',
    );

    setItem.mockRestore();
    act(() => {
      dispatch(
        Action.RenameElement({
          elementId: actorElement,
          name: 'Changed again',
        }),
      );
    });

    expect(asked()).toBe(false);
  });
});

describe('opening', () => {
  it('puts the model a file carries into the store', async () => {
    const user = userEvent.setup();
    mounted(specBridge({ offers: chosenFile('model.yaml', nativeText) }));

    await choose(user, 'Open');

    await waitFor(() => {
      expect(nameOf(modelStore.getState().file)).toBe('model.yaml');
    });
    expect(await shown(user)).toContain('model.yaml');
  });

  it('asks in the menu before losing changes that are in no file', async () => {
    const user = userEvent.setup();
    mounted(specBridge({ offers: chosenFile('model.yaml', nativeText) }));
    edit();

    await choose(user, 'Open');

    expect(item('Discard changes and open')).toBeDefined();
    expect(modelStore.getState().file._tag).toBe('NoFile');
    expect(isDirty(modelStore.getState())).toBe(true);

    await user.click(item('Cancel'));

    await openMenu(user);
    expect(item('Open')).toBeDefined();
  });

  it('opens on the second step, dropping the changes it warned about', async () => {
    const user = userEvent.setup();
    mounted(specBridge({ offers: chosenFile('model.yaml', nativeText) }));
    edit();

    await choose(user, 'Open');
    await user.click(item('Discard changes and open'));

    await waitFor(() => {
      expect(nameOf(modelStore.getState().file)).toBe('model.yaml');
    });
    expect(isDirty(modelStore.getState())).toBe(false);
  });

  it('opens the menu on the open question when the chord asks', async () => {
    const user = userEvent.setup();
    mounted(specBridge());
    edit();

    await user.keyboard('{Control>}O{/Control}');

    expect(
      await screen.findByRole('menuitem', {
        name: 'Discard changes and open',
      }),
    ).toBeDefined();
  });

  it('takes the open question back when the menu is dismissed', async () => {
    const user = userEvent.setup();
    mounted(specBridge());
    edit();

    await choose(user, 'Open');
    await user.keyboard('{Escape}');

    await openMenu(user);
    expect(item('Open')).toBeDefined();
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

    await choose(user, 'Open');

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
      expect(state()).toContain('model.yaml');
    });
  });

  it('says what the read dropped, which no later save can report', async () => {
    const user = userEvent.setup();
    const bridge = specBridge({
      offers: chosenFile('ecluse.json', await withUndeclaredKeys()),
    });
    mounted(bridge);

    await choose(user, 'Open');

    await waitFor(() => {
      expect(reportEntries().length > 0).toBe(true);
    });
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

    await choose(user, 'Open');

    expect(modelStore.getState().file._tag).toBe('NoFile');
    expect(isDirty(modelStore.getState())).toBe(false);
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
    await choose(user, 'Open');
    await waitFor(() => {
      expect(reportEntries().length > 0).toBe(true);
    });

    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [chosenFile('notes.txt', 'no threat model here')] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('failure-notice').textContent).toContain(
        'notes.txt',
      );
    });
    expect(reportEntries().length > 0).toBe(true);
  });

  it('opens through its own file input where the bridge has no picker', async () => {
    const user = userEvent.setup();
    const clicks = vi.spyOn(HTMLInputElement.prototype, 'click');
    mounted(specBridge({ picker: false }));

    await choose(user, 'Open');

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
    expect(await shown(user)).toContain('threat-model.yaml');
    expect(isDirty(modelStore.getState())).toBe(false);
  });

  it('asks the format in the menu where the platform has no picker, and takes the question back', async () => {
    const user = userEvent.setup();
    const bridge = specBridge({ picker: false });
    mounted(bridge);

    await choose(user, 'Save as');

    await screen.findByRole('menuitem', { name: 'Save as Saerskriven YAML' });
    expect(screen.getAllByRole('menuitem')).toHaveLength(14);
    expect(item('Save as Saerskriven YAML')).toBeDefined();
    expect(item('Save as Threat Dragon JSON')).toBeDefined();
    expect(item('Export')).toBeDefined();
    expect(item('View source on GitHub')).toBeDefined();
    expect(bridge.writes).toEqual([]);

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null);
    });
    await openMenu(user);

    expect(item('Save as')).toBeDefined();
  });

  it('writes the current format from the fallback menu', async () => {
    const user = userEvent.setup();
    const bridge = specBridge({ picker: false });
    mounted(bridge);

    await choose(user, 'Save as');
    await user.click(item('Save as Saerskriven YAML'));

    await waitFor(() => {
      expect(bridge.writes[0]?.name).toBe('threat-model.yaml');
    });
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

    await user.click(screen.getByRole('button', { name: 'Dismiss report' }));

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
    await choose(user, 'Open');
    await waitFor(() => {
      expect(nameOf(modelStore.getState().file)).toBe('model.yaml');
    });

    await choose(user, 'New model');

    expect(modelStore.getState().present).toBe(placeholderModel);
    expect(modelStore.getState().file._tag).toBe('NoFile');
    expect(isDirty(modelStore.getState())).toBe(false);
  });

  it('asks in the menu rather than in a dialog, and puts it away when the file is kept', async () => {
    const user = userEvent.setup();
    const bridge = specBridge();
    mounted(bridge);
    edit();

    await choose(user, 'New model');

    expect(item('Discard changes and create new model')).toBeDefined();

    await user.click(item('Cancel'));

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null);
    });
    expect(isDirty(modelStore.getState())).toBe(true);
    expect(bridge.releases.count).toBe(0);

    await openMenu(user);

    expect(item('New model')).toBeDefined();
  });

  it('closes on the second step, dropping the changes it warned about', async () => {
    const user = userEvent.setup();
    mounted(specBridge());
    edit();

    await choose(user, 'New model');
    await user.click(item('Discard changes and create new model'));

    expect(modelStore.getState().present).toBe(placeholderModel);
    expect(modelStore.getState().file._tag).toBe('NoFile');
    expect(isDirty(modelStore.getState())).toBe(false);
  });

  it('keeps the session and handle until recovery clears', async () => {
    const user = userEvent.setup();
    const bridge = specBridge();
    mounted(bridge);
    edit();
    await choose(user, 'New model');
    const removeItem = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementationOnce(() => {
        throw new Error('Clear failed.');
      });

    await user.click(item('Discard changes and create new model'));

    expect(isDirty(modelStore.getState())).toBe(true);
    expect(bridge.releases.count).toBe(0);
    expect(screen.getByTestId('failure-notice').textContent).toContain(
      'Local recovery is unavailable.',
    );

    removeItem.mockRestore();
    await choose(user, 'New model');
    await user.click(item('Discard changes and create new model'));

    expect(modelStore.getState().present).toBe(placeholderModel);
    expect(bridge.releases.count).toBe(1);
  });

  it('opens the menu on the question when the chord asks with the menu shut', async () => {
    const user = userEvent.setup();
    mounted(specBridge());
    edit();

    await user.keyboard('{Control>}{Shift>}X{/Shift}{/Control}');

    expect(
      await screen.findByRole('menuitem', {
        name: 'Discard changes and create new model',
      }),
    ).toBeDefined();
    expect(isDirty(modelStore.getState())).toBe(true);
  });

  it('takes the question back when a save lands under it', async () => {
    const user = userEvent.setup();
    mounted(specBridge());
    edit();

    await choose(user, 'New model');

    expect(item('Discard changes and create new model')).toBeDefined();

    act(() => {
      dispatch(Action.Saved({ name: 'model.yaml', source: nativeSource }));
    });

    expect(
      screen.queryByRole('menuitem', {
        name: 'Discard changes and create new model',
      }),
    ).toBe(null);
    expect(item('New model')).toBeDefined();
  });

  it('takes the question back when the menu is dismissed', async () => {
    const user = userEvent.setup();
    mounted(specBridge());
    edit();

    await choose(user, 'New model');
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null);
    });

    await openMenu(user);

    expect(item('New model')).toBeDefined();
  });
});
