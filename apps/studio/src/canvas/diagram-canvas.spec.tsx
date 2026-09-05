import type { ElementId } from '@panoptes/model';
import { fireEvent, render, screen } from '@testing-library/react';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { canvasModel, readerElement, requestFlow } from './canvas.fixtures.js';
import { DiagramCanvas } from './diagram-canvas.js';

const opened = (selection?: ElementId): void => {
  modelStore.setState({ ...initialState(canvasModel), selection }, true);
};

const reader = (): HTMLElement =>
  screen.getByRole('group', { name: /^Reader, actor/u });

describe('DiagramCanvas', () => {
  beforeEach(() => {
    opened();
  });

  it('mounts one node per element, each named from the model', () => {
    render(<DiagramCanvas />);

    expect(screen.getByTestId('canvas-container')).toBeTruthy();
    expect(
      screen.getByRole('group', {
        name: 'Reader, actor, 1 open threat, highest severity medium',
      }),
    ).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Studio, process' })).toBeTruthy();
  });

  it('reaches every element by keyboard', () => {
    render(<DiagramCanvas />);

    expect(
      screen
        .getByRole('group', { name: 'Studio, process' })
        .getAttribute('tabindex'),
    ).toBe('0');
  });

  it('draws the selection the store holds', () => {
    opened(readerElement);
    render(<DiagramCanvas />);

    expect(reader().classList.contains('selected')).toBe(true);
  });

  it('selects the element that was clicked, through the store', () => {
    render(<DiagramCanvas />);

    fireEvent.click(reader());

    expect(modelStore.getState().selection).toBe(readerElement);
    expect(reader().classList.contains('selected')).toBe(true);
  });

  it('clears a selected flow when the pointer lands on nothing', () => {
    opened(requestFlow);
    render(<DiagramCanvas />);
    const pane = document.querySelector('.react-flow__pane');
    expect(pane).not.toBeNull();

    fireEvent.click(pane ?? document.body);

    expect(modelStore.getState().selection).toBeUndefined();
  });
});
