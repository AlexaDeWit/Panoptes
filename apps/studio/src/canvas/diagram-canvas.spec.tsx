import { render, screen } from '@testing-library/react';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { canvasModel, readerElement } from './canvas.fixtures.js';
import { DiagramCanvas } from './diagram-canvas.js';

describe('DiagramCanvas', () => {
  beforeEach(() => {
    modelStore.setState(initialState(canvasModel), true);
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
    modelStore.setState(
      { ...initialState(canvasModel), selection: readerElement },
      true,
    );
    render(<DiagramCanvas />);

    expect(
      screen
        .getByRole('group', { name: /^Reader, actor/u })
        .classList.contains('selected'),
    ).toBe(true);
  });
});
