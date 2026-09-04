import { emptyModel } from '@panoptes/model';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { App } from './app.js';

const elementsShown = (): string | null =>
  screen.getByTestId('element-count').textContent;

const undoButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Undo' });

const addButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Add a process' });

const severityField = (): HTMLElement =>
  screen.getByRole('combobox', { name: 'Severity' });

const severityShown = (): string => severityField().textContent ?? '';

const chooseSeverity = async (keys: string): Promise<void> => {
  const user = userEvent.setup();
  severityField().focus();
  await user.keyboard(`{Enter}${keys}{Enter}`);
};

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

  it('offers no add where the model holds no diagram to add to', () => {
    modelStore.setState(initialState(emptyModel), true);
    render(<App />);
    expect(addButton()).toHaveProperty('disabled', true);
  });

  it('offers undo only once there is something to undo', () => {
    render(<App />);
    expect(undoButton()).toHaveProperty('disabled', true);
    fireEvent.click(addButton());
    expect(undoButton()).toHaveProperty('disabled', false);
  });

  it('commits a severity chosen in the panel and takes it back through undo', async () => {
    render(<App />);
    expect(severityShown()).toContain('medium');

    await chooseSeverity('{ArrowDown}');

    expect(severityShown()).toContain('high');
    fireEvent.click(undoButton());
    expect(severityShown()).toContain('medium');
  });

  it('leaves nothing to undo when the severity chosen is the one already set', async () => {
    render(<App />);
    expect(undoButton()).toHaveProperty('disabled', true);

    await chooseSeverity('');

    expect(severityShown()).toContain('medium');
    expect(undoButton()).toHaveProperty('disabled', true);
  });
});
