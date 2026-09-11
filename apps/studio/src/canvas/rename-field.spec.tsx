import { canvasClassNames, wrappedTextStyles } from '@saerskriven/canvas';
import type { ElementId } from '@saerskriven/model';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hostPlatform } from '../commands/shortcuts.js';
import { elementById } from '../store/selectors.js';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';
import {
  canvasModel,
  noteElement,
  readerElement,
  studioElement,
} from './canvas.fixtures.js';
import { DiagramCanvas } from './diagram-canvas.js';

const softHyphen = '­';

const editing = (
  elementId: ElementId,
  kind: 'name' | 'note' = 'name',
): void => {
  modelStore.setState(
    {
      ...initialState(canvasModel),
      selection: [elementId],
      inlineEditor: { kind, elementId },
    },
    true,
  );
  resetAnnouncements();
};

const field = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name });

const nameOf = (elementId: ElementId): string | undefined =>
  elementById(modelStore.getState(), elementId)?.name;

const textOf = (elementId: ElementId): string | undefined => {
  const element = elementById(modelStore.getState(), elementId);
  return element?.kind === 'text' ? element.text : undefined;
};

const state = () => modelStore.getState();

const drawnText = (elementId: ElementId, run: string): Element | null =>
  document.querySelector(`[data-id="${elementId}"] text.${run}`);

describe('the inline editor', () => {
  it('labels a name field with what it renames', () => {
    editing(readerElement);
    render(<DiagramCanvas />);

    expect(field('Name of Reader')).toHaveProperty('value', 'Reader');
  });

  it('commits a name on Enter as one undo step', async () => {
    const user = userEvent.setup();
    editing(readerElement);
    render(<DiagramCanvas />);

    await user.clear(field('Name of Reader'));
    await user.type(field('Name of Reader'), 'Auditor{Enter}');

    expect(nameOf(readerElement)).toBe('Auditor');
    expect(state().past).toHaveLength(1);
    expect(state().inlineEditor).toBeUndefined();
  });

  it('commits a name when it is left', async () => {
    const user = userEvent.setup();
    editing(readerElement);
    render(<DiagramCanvas />);

    await user.clear(field('Name of Reader'));
    await user.type(field('Name of Reader'), 'Auditor');
    await user.tab();

    expect(nameOf(readerElement)).toBe('Auditor');
    expect(document.activeElement?.getAttribute('data-id')).not.toBe(
      readerElement,
    );
  });

  it('leaves the name alone on Escape', async () => {
    const user = userEvent.setup();
    editing(readerElement);
    render(<DiagramCanvas />);

    await user.clear(field('Name of Reader'));
    await user.type(field('Name of Reader'), 'Auditor{Escape}');

    expect(nameOf(readerElement)).toBe('Reader');
    expect(state().past).toEqual([]);
    expect(state().inlineEditor).toBeUndefined();
  });

  it('dispatches nothing for a name the model already holds', async () => {
    const user = userEvent.setup();
    editing(readerElement);
    render(<DiagramCanvas />);

    await user.type(field('Name of Reader'), '{Enter}');

    expect(state().present).toBe(canvasModel);
    expect(state().past).toEqual([]);
    expect(state().inlineEditor).toBeUndefined();
  });

  it('keeps a refused character on screen and announces its position', async () => {
    const user = userEvent.setup();
    editing(readerElement);
    render(<DiagramCanvas />);

    await user.clear(field('Name of Reader'));
    await user.type(field('Name of Reader'), `Soft${softHyphen}hyphen{Enter}`);

    expect(nameOf(readerElement)).toBe('Reader');
    expect(state().inlineEditor).toEqual({
      kind: 'name',
      elementId: readerElement,
    });
    expect(field('Name of Reader')).toHaveProperty('value', 'Soft­hyphen');
    expect(currentAnnouncement().message).toContain('Reader');
    expect(currentAnnouncement().message).toContain('5');
  });

  it.each(['   ', ''])('refuses an empty name', async (name) => {
    const user = userEvent.setup();
    editing(readerElement);
    render(<DiagramCanvas />);

    await user.clear(field('Name of Reader'));
    await user.type(field('Name of Reader'), `${name}{Enter}`);

    expect(nameOf(readerElement)).toBe('Reader');
    expect(state().inlineEditor).toEqual({
      kind: 'name',
      elementId: readerElement,
    });
    expect(currentAnnouncement().message.trim()).not.toBe('');
  });

  it('commits multiline note text on blur as one undo step', async () => {
    const user = userEvent.setup();
    editing(noteElement, 'note');
    render(<DiagramCanvas />);
    const note = field('Note text');

    await user.clear(note);
    await user.type(note, 'First line{Enter}Second line');
    await user.tab();

    expect(textOf(noteElement)).toBe('First line\nSecond line');
    expect(state().past).toHaveLength(1);
    expect(state().inlineEditor).toBeUndefined();
  });

  it('commits a Note with the platform modifier and leaves the foreign one alone', async () => {
    const user = userEvent.setup();
    editing(noteElement, 'note');
    render(<DiagramCanvas />);
    const note = field('Note text');

    await user.clear(note);
    await user.type(note, 'Changed');
    fireEvent.keyDown(note, {
      key: 'Enter',
      ...(hostPlatform === 'apple' ? { ctrlKey: true } : { metaKey: true }),
    });

    expect(textOf(noteElement)).not.toBe('Changed');
    expect(state().inlineEditor).toEqual({
      kind: 'note',
      elementId: noteElement,
    });

    fireEvent.keyDown(note, {
      key: 'Enter',
      ...(hostPlatform === 'apple' ? { metaKey: true } : { ctrlKey: true }),
    });

    expect(textOf(noteElement)).toBe('Changed');
    expect(state().inlineEditor).toBeUndefined();
  });
});

describe('the field standing where the text is drawn', () => {
  it('takes the place of a name while it is open, and hands it back', async () => {
    const user = userEvent.setup();
    editing(readerElement);
    render(<DiagramCanvas />);

    expect(drawnText(readerElement, canvasClassNames.label)).toBeNull();

    await user.type(field('Name of Reader'), '{Escape}');

    expect(drawnText(readerElement, canvasClassNames.label)).not.toBeNull();
  });

  it('is set in the type the text is drawn in', () => {
    editing(noteElement, 'note');
    render(<DiagramCanvas />);

    expect(field('Note text').style.fontSize).toBe(
      `${String(wrappedTextStyles.note.fontSize)}px`,
    );
  });

  it('stays inside the box of the element it names', () => {
    editing(studioElement);
    render(<DiagramCanvas />);

    expect(field('Name of Studio').style.maxHeight).toBe('60px');
  });

  it('keeps a name on one line when pasted text carries a line break', async () => {
    const user = userEvent.setup();
    editing(readerElement);
    render(<DiagramCanvas />);

    await user.clear(field('Name of Reader'));
    await user.paste('Audit\nor');

    expect(field('Name of Reader')).toHaveProperty('value', 'Auditor');
  });
});
