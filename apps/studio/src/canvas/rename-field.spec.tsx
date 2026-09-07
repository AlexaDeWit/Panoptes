import type { ElementId } from '@saerskriven/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { elementById } from '../store/selectors.js';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';
import { canvasModel, noteElement, readerElement } from './canvas.fixtures.js';
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
});
