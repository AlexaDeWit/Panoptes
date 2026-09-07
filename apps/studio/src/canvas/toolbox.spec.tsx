import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialState } from '../store/state.js';
import type { State } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { resetAnnouncements } from './announcements.js';
import { resetConnecting, startFlow } from './connecting.js';
import { canvasModel, readerElement } from './canvas.fixtures.js';
import { currentTool, resetTools } from './tools.js';
import { Toolbox } from './toolbox.js';

const opened = (selection?: State['selection']): void => {
  modelStore.setState({ ...initialState(canvasModel), selection }, true);
  resetAnnouncements();
  resetConnecting();
  resetTools();
};

const elementCount = (): number =>
  modelStore.getState().present.diagrams[0].elements.length;

describe('Toolbox', () => {
  beforeEach(() => {
    opened();
  });

  it('offers Select, every element kind and Hand as icon buttons', () => {
    render(<Toolbox />);

    for (const name of [
      'Select',
      'Actor',
      'Process',
      'Store',
      'Trust boundary',
      'Trust boundary curve',
      'Hand',
    ]) {
      const control = screen.getByRole('button', { name });
      expect(control.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
        'true',
      );
    }
  });

  it('selects a mode without editing the model', async () => {
    const user = userEvent.setup();
    render(<Toolbox />);

    await user.click(screen.getByRole('button', { name: 'Actor' }));

    expect(currentTool()).toMatchObject({ active: 'actor', locked: false });
    expect(elementCount()).toBe(6);
    expect(
      screen
        .getByRole('button', { name: 'Actor' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('locks an element mode on a double click', async () => {
    const user = userEvent.setup();
    render(<Toolbox />);

    await user.dblClick(screen.getByRole('button', { name: 'Store' }));

    expect(currentTool()).toMatchObject({ active: 'store', locked: true });
  });

  it('shows every shortcut in the icon tooltip', async () => {
    render(<Toolbox />);
    act(() => {
      screen.getByRole('button', { name: 'Actor' }).focus();
    });

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Actor');
    expect(within(tooltip).getByText('A or 2')).toBeDefined();
  });

  it('keeps the canvas message region mounted while it has nothing to say', () => {
    render(<Toolbox />);

    expect(screen.getByTestId('canvas-announcement').textContent).toBe('');
  });

  it('opens the connector command chooser without adding a flow tool', () => {
    opened(readerElement);
    startFlow();

    render(<Toolbox />);

    expect(screen.getByRole('listbox')).toBeDefined();
    expect(screen.queryByRole('button', { name: /flow tool/iu })).toBeNull();
  });

  it('commits the connector command target directly', async () => {
    const user = userEvent.setup();
    opened(readerElement);
    startFlow();
    render(<Toolbox />);

    await user.click(screen.getByRole('option', { name: 'Studio' }));

    expect(elementCount()).toBe(7);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
