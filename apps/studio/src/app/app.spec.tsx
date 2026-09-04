import { fireEvent, render, screen } from '@testing-library/react';
import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { App } from './app.js';

const elementsShown = (): string | null =>
  screen.getByTestId('element-count').textContent;

const undoButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Undo' });

const addButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Add a process' });

describe('App', () => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
  });

  it('renders the canvas', () => {
    const { getAllByText } = render(<App />);
    expect(getAllByText('model').length > 0).toBeTruthy();
  });

  it('shows a dispatched edit and takes it back through undo', () => {
    render(<App />);
    expect(elementsShown()).toBe('2');
    fireEvent.click(addButton());
    expect(elementsShown()).toBe('3');
    fireEvent.click(undoButton());
    expect(elementsShown()).toBe('2');
  });

  it('offers undo only once there is something to undo', () => {
    render(<App />);
    expect(undoButton()).toHaveProperty('disabled', true);
    fireEvent.click(addButton());
    expect(undoButton()).toHaveProperty('disabled', false);
  });
});
