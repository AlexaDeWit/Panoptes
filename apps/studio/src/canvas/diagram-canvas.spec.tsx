import type { ElementId } from '@panoptes/model';
import { fireEvent, render, screen } from '@testing-library/react';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { canvasModel, readerElement, requestFlow } from './canvas.fixtures.js';
import { DiagramCanvas } from './diagram-canvas.js';

const opened = (selection?: ElementId): void => {
  modelStore.setState({ ...initialState(canvasModel), selection }, true);
  resetAnnouncements();
};

const elementCount = (): number =>
  modelStore.getState().present.diagrams[0].elements.length;

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

  it('removes the selected element on the delete key, and says what went with it', () => {
    opened(readerElement);
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'Delete' });

    expect(elementCount()).toBe(5);
    expect(currentAnnouncement().message).toBe(
      'Removed Reader, actor, 1 open threat, highest severity medium. 1 flow detached, 1 threat link dropped.',
    );
  });

  it('removes the selected flow on the backspace key', () => {
    opened(requestFlow);
    render(<DiagramCanvas />);

    fireEvent.keyDown(screen.getByTestId('rf__wrapper'), { key: 'Backspace' });

    expect(elementCount()).toBe(5);
  });

  it('leaves the model alone on the delete key while nothing is selected', () => {
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'Delete' });

    expect(elementCount()).toBe(6);
    expect(currentAnnouncement().message).toBe('');
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
