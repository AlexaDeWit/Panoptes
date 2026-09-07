import type { ElementId } from '@saerskriven/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';
import { canvasModel, readerElement } from './canvas.fixtures.js';
import { DiagramCanvas } from './diagram-canvas.js';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { elementById } from '../store/selectors.js';

const softHyphen = '­';

const renaming = (elementId: ElementId): void => {
  modelStore.setState(
    { ...initialState(canvasModel), selection: elementId, renaming: elementId },
    true,
  );
  resetAnnouncements();
};

const field = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name });

const nameOf = (elementId: ElementId): string | undefined =>
  elementById(modelStore.getState(), elementId)?.name;

const state = () => modelStore.getState();

describe('the rename field', () => {
  it('is labelled with what it renames', () => {
    renaming(readerElement);
    render(<DiagramCanvas />);

    expect(field('Name of Reader')).toHaveProperty('value', 'Reader');
  });

  it('commits on Enter as one undo step', async () => {
    const user = userEvent.setup();
    renaming(readerElement);
    render(<DiagramCanvas />);

    await user.clear(field('Name of Reader'));
    await user.type(field('Name of Reader'), 'Auditor{Enter}');

    expect(nameOf(readerElement)).toBe('Auditor');
    expect(state().past).toHaveLength(1);
    expect(state().renaming).toBeUndefined();
  });

  it('commits when it is left, leaving focus where it went', async () => {
    const user = userEvent.setup();
    renaming(readerElement);
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
    renaming(readerElement);
    render(<DiagramCanvas />);

    await user.clear(field('Name of Reader'));
    await user.type(field('Name of Reader'), 'Auditor{Escape}');

    expect(nameOf(readerElement)).toBe('Reader');
    expect(state().past).toEqual([]);
    expect(state().renaming).toBeUndefined();
  });

  it('dispatches nothing for a name the model already holds', async () => {
    const user = userEvent.setup();
    renaming(readerElement);
    render(<DiagramCanvas />);

    await user.type(field('Name of Reader'), '{Enter}');

    expect(state().present).toBe(canvasModel);
    expect(state().past).toEqual([]);
    expect(state().renaming).toBeUndefined();
  });

  it('keeps a refused character on screen and says which one stopped it', async () => {
    const user = userEvent.setup();
    renaming(readerElement);
    render(<DiagramCanvas />);

    await user.clear(field('Name of Reader'));
    await user.type(field('Name of Reader'), `Soft${softHyphen}hyphen{Enter}`);

    expect(nameOf(readerElement)).toBe('Reader');
    expect(state().renaming).toBe(readerElement);
    expect(field('Name of Reader')).toHaveProperty('value', 'Soft­hyphen');
    expect(currentAnnouncement().message).toContain('Reader');
    expect(currentAnnouncement().message).toContain('5');
  });

  it('refuses a name of whitespace, which draws as no name at all', async () => {
    const user = userEvent.setup();
    renaming(readerElement);
    render(<DiagramCanvas />);

    await user.clear(field('Name of Reader'));
    await user.type(field('Name of Reader'), '   {Enter}');

    expect(nameOf(readerElement)).toBe('Reader');
    expect(state().renaming).toBe(readerElement);
    expect(currentAnnouncement().message.trim()).not.toBe('');
  });

  it('refuses an empty name the same way', async () => {
    const user = userEvent.setup();
    renaming(readerElement);
    render(<DiagramCanvas />);

    await user.clear(field('Name of Reader'));
    await user.type(field('Name of Reader'), '{Enter}');

    expect(nameOf(readerElement)).toBe('Reader');
    expect(state().renaming).toBe(readerElement);
    expect(currentAnnouncement().message.trim()).not.toBe('');
  });
});
