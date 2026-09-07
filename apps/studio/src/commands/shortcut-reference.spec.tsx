import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../app/app.js';
import { resetTools } from '../canvas/tools.js';
import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { contextualShortcuts } from './contextual-shortcuts.js';
import { commands } from './registry.js';
import { ShortcutReference } from './shortcut-reference.js';

const idsOf = (attribute: string): string[] =>
  [...document.querySelectorAll(`[${attribute}]`)].map(
    (entry) => entry.getAttribute(attribute) ?? '',
  );

const commandRow = (id: string): HTMLElement =>
  document.querySelector(`[data-command-id="${id}"]`) ?? document.body;

const contextualRow = (id: string): HTMLElement =>
  document.querySelector(`[data-contextual-id="${id}"]`) ?? document.body;

describe('ShortcutReference', () => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
    resetTools();
  });

  it('renders every metadata entry exactly once with platform spelling', () => {
    render(<ShortcutReference onClose={() => undefined} platform="apple" />);

    const commandIds = idsOf('data-command-id');
    const contextualIds = idsOf('data-contextual-id');
    expect(commandIds).toHaveLength(commands.length);
    expect(new Set(commandIds)).toEqual(
      new Set(commands.map((command) => command.id)),
    );
    expect(contextualIds).toHaveLength(contextualShortcuts.length);
    expect(new Set(contextualIds)).toEqual(
      new Set(contextualShortcuts.map((entry) => entry.id)),
    );
    expect(within(commandRow('save')).getByText('⌘S')).toBeTruthy();
    expect(
      within(commandRow('shortcut-reference')).getByText('? or F1'),
    ).toBeTruthy();
    expect(
      within(commandRow('export-pdf')).getByText('No shortcut'),
    ).toBeTruthy();
    expect(
      within(contextualRow('select-canvas-item')).getByText('Enter or Space'),
    ).toBeTruthy();
  });

  it('focuses its heading and closes from Escape inside the panel', () => {
    const close = vi.fn<() => void>();
    render(<ShortcutReference onClose={close} />);
    const heading = screen.getByRole('heading', {
      level: 2,
      name: 'Keyboard shortcuts',
    });

    expect(document.activeElement).toBe(heading);
    fireEvent.keyDown(heading, { key: 'Escape' });

    expect(close).toHaveBeenCalledOnce();
  });

  it('opens from the menu and returns focus to its trigger', async () => {
    const user = userEvent.setup();
    render(<App />);
    const menu = screen.getByRole('button', { name: 'Menu' });

    await user.click(menu);
    await user.click(
      await screen.findByRole('menuitem', { name: 'Keyboard shortcuts' }),
    );

    expect(
      screen.getByRole('region', { name: 'Keyboard shortcuts' }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2, name: 'Keyboard shortcuts' }),
    );

    await user.click(
      screen.getByRole('button', { name: 'Close keyboard shortcuts' }),
    );

    expect(
      screen.queryByRole('region', { name: 'Keyboard shortcuts' }),
    ).toBeNull();
    expect(document.activeElement).toBe(menu);
  });

  it('toggles from either registered key outside text fields', async () => {
    render(<App />);
    const menu = screen.getByRole('button', { name: 'Menu' });
    const canvas = screen.getByRole('application', { name: 'Diagram' });
    const description = canvas.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(description)?.textContent).toContain(
      'Edit the selected canvas text: Enter',
    );
    menu.focus();

    fireEvent.keyDown(menu, { key: '?', shiftKey: true });
    expect(
      await screen.findByRole('region', { name: 'Keyboard shortcuts' }),
    ).toBeTruthy();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'F1' });
    expect(
      screen.queryByRole('region', { name: 'Keyboard shortcuts' }),
    ).toBeNull();

    fireEvent.keyDown(menu, { key: 'F1' });
    expect(
      await screen.findByRole('region', { name: 'Keyboard shortcuts' }),
    ).toBeTruthy();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: '?',
      shiftKey: true,
    });
    expect(
      screen.queryByRole('region', { name: 'Keyboard shortcuts' }),
    ).toBeNull();
  });

  it('leaves Escape outside the panel to the canvas command', async () => {
    render(<App />);
    const menu = screen.getByRole('button', { name: 'Menu' });

    fireEvent.keyDown(menu, { key: 'F1' });
    await screen.findByRole('region', { name: 'Keyboard shortcuts' });
    menu.focus();
    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(
      screen.getByRole('region', { name: 'Keyboard shortcuts' }),
    ).toBeTruthy();
  });
});
