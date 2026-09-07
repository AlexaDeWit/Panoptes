import type { ElementId } from '@saerskriven/model';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  canvasModel,
  readerElement,
  requestFlow,
  studioElement,
} from './canvas.fixtures.js';
import { DiagramCanvas } from './diagram-canvas.js';
import { currentLayout } from './layout.js';
import { resetTools } from './tools.js';

const opened = (selection: readonly ElementId[] = []): void => {
  modelStore.setState({ ...initialState(canvasModel), selection }, true);
  resetAnnouncements();
  resetTools();
};

const elementCount = (): number =>
  modelStore.getState().present.diagrams[0].elements.length;

const reader = (): HTMLElement =>
  screen.getByRole('group', { name: /^Reader, actor/u });

const readerBox = () => {
  const node = currentLayout(modelStore.getState()).nodes.find(
    (candidate) => candidate.id === readerElement,
  );
  expect(node).toBeDefined();
  return node === undefined
    ? undefined
    : { position: node.position, size: node.size };
};

const resizeControl = (from: string): HTMLElement =>
  screen.getByRole('button', { name: `Resize Reader from ${from}` });

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
    opened([readerElement]);
    render(<DiagramCanvas />);

    expect(reader().classList.contains('selected')).toBe(true);
  });

  it('selects the element that was clicked, through the store', () => {
    render(<DiagramCanvas />);

    fireEvent.click(reader());

    expect(modelStore.getState().selection).toEqual([readerElement]);
    expect(reader().classList.contains('selected')).toBe(true);
  });

  it('draws a selection the store moves to after it has mounted', () => {
    render(<DiagramCanvas />);

    act(() => {
      dispatch(Action.Select({ elementIds: [readerElement] }));
    });

    expect(reader().classList.contains('selected')).toBe(true);
  });

  it('removes the selected element on the delete key, and says what went with it', () => {
    opened([readerElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'Delete' });

    expect(elementCount()).toBe(5);
    expect(currentAnnouncement().message).toContain('Reader');
    expect(currentAnnouncement().message).toContain('1');
  });

  it('removes the selected flow on the backspace key', () => {
    opened([requestFlow]);
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

  it('draws the threat panel over itself while an element is selected', () => {
    render(<DiagramCanvas />);
    expect(screen.queryByRole('region', { name: 'Threats' })).toBeNull();

    act(() => {
      dispatch(Action.Select({ elementIds: [readerElement] }));
    });

    expect(screen.getByRole('region', { name: 'Threats' })).toBeDefined();
    expect(
      screen
        .getByTestId('canvas-container')
        .contains(screen.getByTestId('threat-panel')),
    ).toBe(true);
  });

  it('hands the panel the keyboard on Enter over the element already selected', () => {
    opened([readerElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'Enter' });

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Add a threat' }),
    );
  });

  it('leaves Enter to React Flow where the press is what selects the element', () => {
    render(<DiagramCanvas />);
    reader().focus();

    fireEvent.keyDown(reader(), { key: 'Enter' });

    expect(modelStore.getState().selection).toEqual([readerElement]);
    expect(document.activeElement).toBe(reader());
  });

  it('reduces a group to the element clicked or activated with Enter', () => {
    opened([readerElement, studioElement]);
    render(<DiagramCanvas />);

    fireEvent.click(reader());
    expect(modelStore.getState().selection).toEqual([readerElement]);

    act(() => {
      dispatch(Action.Select({ elementIds: [readerElement, studioElement] }));
    });
    fireEvent.keyDown(reader(), { key: 'Enter' });
    expect(modelStore.getState().selection).toEqual([readerElement]);
  });

  it('toggles a focused element with Shift+Enter', () => {
    opened([readerElement, studioElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'Enter', shiftKey: true });
    expect(modelStore.getState().selection).toEqual([studioElement]);

    fireEvent.keyDown(reader(), { key: 'Enter', shiftKey: true });
    expect(modelStore.getState().selection).toEqual([
      studioElement,
      readerElement,
    ]);
  });

  it('settles a keyboard move through the transient edge path', () => {
    opened([readerElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'ArrowRight' });

    expect(modelStore.getState().past).toHaveLength(1);
  });

  it.each([
    [
      'top',
      'ArrowUp',
      { position: { x: 0, y: -5 }, size: { width: 120, height: 65 } },
    ],
    [
      'right',
      'ArrowRight',
      { position: { x: 0, y: 0 }, size: { width: 125, height: 60 } },
    ],
    [
      'bottom',
      'ArrowDown',
      { position: { x: 0, y: 0 }, size: { width: 120, height: 65 } },
    ],
    [
      'left',
      'ArrowLeft',
      { position: { x: -5, y: 0 }, size: { width: 125, height: 60 } },
    ],
  ] as const)(
    'resizes from the %s by keyboard with the opposite side fixed',
    (from, key, expected) => {
      opened([readerElement]);
      render(<DiagramCanvas />);

      fireEvent.keyDown(resizeControl(from), { key });

      expect(readerBox()).toEqual(expected);
      expect(modelStore.getState().past).toHaveLength(1);
    },
  );

  it('shrinks in the reverse direction and undo restores the full box', () => {
    opened([readerElement]);
    render(<DiagramCanvas />);
    const before = readerBox();

    fireEvent.keyDown(resizeControl('top'), { key: 'ArrowDown' });

    expect(readerBox()).toEqual({
      position: { x: 0, y: 5 },
      size: { width: 120, height: 55 },
    });
    act(() => {
      dispatch(Action.Undo());
    });
    expect(readerBox()).toEqual(before);
  });

  it('clears a selected flow when the pointer lands on nothing', () => {
    opened([requestFlow]);
    render(<DiagramCanvas />);
    const pane = document.querySelector('.react-flow__pane');
    expect(pane).not.toBeNull();

    fireEvent.pointerDown(pane ?? document.body, {
      button: 0,
      isPrimary: true,
      pointerId: 1,
    });
    fireEvent.pointerUp(pane ?? document.body, {
      button: 0,
      isPrimary: true,
      pointerId: 1,
    });

    expect(modelStore.getState().selection).toEqual([]);
  });

  it('opens the name of a node in a field on the second click of a pair', () => {
    render(<DiagramCanvas />);

    fireEvent.click(reader(), { detail: 1 });
    fireEvent.click(reader(), { detail: 2 });

    expect(modelStore.getState().inlineEditor).toEqual({
      kind: 'name',
      elementId: readerElement,
    });
  });

  it('leaves a click on a canvas control out of the rename gesture', () => {
    render(<DiagramCanvas />);

    fireEvent.click(reader(), { detail: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }), {
      detail: 2,
    });

    expect(modelStore.getState().inlineEditor).toBeUndefined();
  });
});
