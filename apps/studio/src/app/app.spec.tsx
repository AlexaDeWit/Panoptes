import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { elementCount } from '../store/selectors.js';
import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { App } from './app.js';

const elementsHeld = (): number => elementCount(modelStore.getState());

const paletteButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'New process' });

const undoThroughMenu = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: /^Menu/u }));
  await user.click(await screen.findByRole('menuitem', { name: 'Undo' }));
};

describe('App', () => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
  });

  it('renders the canvas', () => {
    render(<App />);
    expect(screen.getByTestId('canvas-container')).toBeTruthy();
  });

  it('mounts the threat panel beside it', () => {
    render(<App />);
    expect(screen.getByRole('region', { name: 'Threats' })).toBeDefined();
  });

  it('names the page for a reader without drawing a title bar over the canvas', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Panoptes',
    );
  });

  it('shows an edit the palette dispatched and takes it back through the menu', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(elementsHeld()).toBe(2);

    await user.click(paletteButton());
    expect(elementsHeld()).toBe(3);

    await undoThroughMenu(user);
    expect(elementsHeld()).toBe(2);
  });
});
