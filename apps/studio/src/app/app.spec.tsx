import { fireEvent, render, screen } from '@testing-library/react';
import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { App } from './app.js';

const elementsShown = (): string | null =>
  screen.getByTestId('element-count').textContent;

const undoButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Undo' });

const paletteButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'New process' });

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

  it('shows an edit the palette dispatched and takes it back through undo', () => {
    render(<App />);
    expect(elementsShown()).toBe('2');
    fireEvent.click(paletteButton());
    expect(elementsShown()).toBe('3');
    fireEvent.click(undoButton());
    expect(elementsShown()).toBe('2');
  });

  it('offers undo only once there is something to undo', () => {
    render(<App />);
    expect(undoButton()).toHaveProperty('disabled', true);
    fireEvent.click(paletteButton());
    expect(undoButton()).toHaveProperty('disabled', false);
  });
});
