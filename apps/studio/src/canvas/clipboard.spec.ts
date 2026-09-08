import { Either } from 'effect';
import { saerskrivenYamlCodec } from '@saerskriven/formats';
import { Action } from '../store/actions.js';
import { initialState, placeholderModel } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { copySelected, duplicateSelected, pasteSelected } from './clipboard.js';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';

const actor = placeholderModel.diagrams[0].elements[0].id;

beforeEach(() => {
  modelStore.setState(
    { ...initialState(placeholderModel), selection: [actor] },
    true,
  );
  resetAnnouncements();
});

it('duplicates attached threats under fresh IDs in one undoable edit without touching the clipboard', () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  duplicateSelected();
  const after = modelStore.getState();
  expect(after.past).toEqual([placeholderModel]);
  expect(after.present.diagrams[0].elements).toHaveLength(4);
  const copy = after.present.diagrams[0].elements[3];
  expect(copy.id).not.toBe(actor);
  expect(after.present.threats.at(-1)?.elements).toEqual([copy.id]);
  expect(after.present.threats.at(-1)?.id).not.toBe(
    placeholderModel.threats[0].id,
  );
  expect(writeText).not.toHaveBeenCalled();
  dispatch(Action.Undo());
  expect(modelStore.getState().present).toBe(placeholderModel);
});

it('keeps the document and clipboard when a cut write fails', async () => {
  const text = 'existing clipboard';
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn<() => Promise<void>>(() =>
        Promise.reject(new Error('denied')),
      ),
      readText: () => Promise.resolve(text),
    },
  });
  const before = modelStore.getState();
  await copySelected(true);
  expect(modelStore.getState()).toBe(before);
  expect(text).toBe('existing clipboard');
  expect(currentAnnouncement().message).toContain('failed');
});

it('copies a flow with its endpoints, and pastes with distinct IDs on each press', async () => {
  let text = '';
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: (next: string) => {
        text = next;
        return Promise.resolve();
      },
      readText: () => Promise.resolve(text),
    },
  });
  dispatch(
    Action.Select({
      elementIds: [placeholderModel.diagrams[0].elements[2].id],
    }),
  );
  await copySelected();
  expect(
    Either.getOrThrow(saerskrivenYamlCodec.read(text)).model.diagrams[0]
      .elements,
  ).toHaveLength(3);
  await pasteSelected();
  await pasteSelected();
  const after = modelStore.getState();
  const elements = after.present.diagrams[0].elements;
  expect(elements).toHaveLength(9);
  expect(new Set(elements.map((element) => element.id)).size).toBe(9);
  expect(after.past).toHaveLength(2);
});

it('refuses unsupported clipboard data without editing or replacing it', async () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText,
      readText: () => Promise.resolve('ordinary text'),
    },
  });
  const before = modelStore.getState();
  await pasteSelected();
  expect(modelStore.getState()).toBe(before);
  expect(writeText).not.toHaveBeenCalled();
});
