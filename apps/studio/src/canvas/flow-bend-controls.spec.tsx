import { act, fireEvent, render, screen } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { canvasModel, requestFlow, readerElement } from './canvas.fixtures.js';
import { DiagramCanvas } from './diagram-canvas.js';
import { currentLayout } from './layout.js';
import { resetTools } from './tools.js';

const press = (key: string, shiftKey = false): void => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key, shiftKey });
};
const points = () =>
  currentLayout(modelStore.getState()).edges.find(
    (edge) => edge.id === requestFlow,
  )?.waypoints;
const add = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Add bend' }));
};

function pointerOn(element: Element, type: string, x: number, y: number): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  Object.defineProperties(event, {
    isPrimary: { value: true },
    pointerId: { value: 1 },
  });
  fireEvent(element, event);
}
const bend = () => screen.getByRole('button', { name: 'Bend 1' });
const sourceEnd = () => screen.getByRole('button', { name: 'Flow source end' });
const source = () => {
  const flow = modelStore
    .getState()
    .present.diagrams[0].elements.find((element) => element.id === requestFlow);
  return flow?.kind === 'flow' ? flow.source : undefined;
};

beforeEach(() => {
  resetTools();
  modelStore.setState(
    { ...initialState(canvasModel), selection: [requestFlow] },
    true,
  );
});

it('keeps insertion keys and clicks separate from typing and unrelated controls', () => {
  render(<DiagramCanvas />);
  add();
  press('x');
  fireEvent.click(document.querySelector('.react-flow__pane') ?? document.body);
  fireEvent.click(document.body);
  expect(document.querySelector('[data-chosen="true"]')).not.toBeNull();
  press('Enter');
  press('x');
  const before = modelStore.getState();
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: 'ArrowRight',
    ctrlKey: true,
  });
  const input = document.createElement('input');
  document.body.append(input);
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(document.body, { key: 'ArrowDown' });
  input.remove();
  pointerOn(
    screen.getByRole('button', { name: 'Add bend' }),
    'pointerdown',
    0,
    0,
  );
  expect(modelStore.getState()).toBe(before);
  press('Enter');
  expect(points()).toEqual([{ x: 210, y: 30 }]);
  fireEvent.click(bend());
  fireEvent.click(document.querySelector('.react-flow__pane') ?? document.body);
  expect(screen.getByRole('button', { name: 'Remove bend' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  add();
  fireEvent.click(bend());
  expect(document.querySelector('[data-chosen="true"]')).not.toBeNull();
  press('Escape');
  expect(modelStore.getState().past).toHaveLength(1);
});

it('wires line and handle pointer gestures and preserves Shift-click deselection', () => {
  render(<DiagramCanvas />);
  const segment =
    document.querySelector('[data-bend-segment="0"]') ?? document.body;
  pointerOn(segment, 'pointerdown', 200, 30);
  pointerOn(segment, 'pointermove', 220, 60);
  expect(points()).toEqual([]);
  pointerOn(segment, 'pointercancel', 220, 60);
  expect(screen.queryByRole('button', { name: 'Bend 1' })).toBeNull();
  pointerOn(segment, 'pointerdown', 200, 30);
  pointerOn(segment, 'pointermove', 220, 60);
  pointerOn(segment, 'pointerup', 220, 60);
  const committed = points();
  expect(committed).toHaveLength(1);
  const handle = bend();
  pointerOn(handle, 'pointerdown', 220, 60);
  pointerOn(handle, 'pointermove', 230, 80);
  pointerOn(handle, 'pointercancel', 230, 80);
  expect(points()).toEqual(committed);
  fireEvent.doubleClick(handle);
  expect(modelStore.getState().inlineEditor).toBeUndefined();
  fireEvent.click(segment);
  fireEvent.click(segment, { shiftKey: true });
  expect(modelStore.getState().selection).toEqual([]);
  expect(points()).toEqual(committed);
});

it('confirms a clicked preview without treating its index as a stored bend', () => {
  render(<DiagramCanvas />);
  add();
  press('Enter');
  press('ArrowDown');
  fireEvent.click(bend());
  expect(points()).toEqual([{ x: 210, y: 35 }]);
  expect(modelStore.getState().past).toHaveLength(1);
  add();
  press('Enter');
  press('ArrowDown');
  fireEvent.click(screen.getByRole('button', { name: 'Bend 2' }));
  expect(points()).toHaveLength(2);
  expect(points()?.[1]).toEqual({ x: 210, y: 35 });
  expect(modelStore.getState().past).toHaveLength(2);
  expect(screen.queryByRole('group', { name: 'Bend actions' })).toBeNull();
});

it('inserts at the chosen segment with keyboard preview, cancellation, and one commit', () => {
  render(<DiagramCanvas />);
  add();
  press('ArrowLeft');
  press('Enter');
  press('ArrowUp');
  press('ArrowRight', true);
  press('ArrowLeft');
  expect(points()).toEqual([]);
  expect(screen.getByRole('button', { name: 'Bend 1' })).toBeTruthy();
  press('Enter');
  expect(points()).toEqual([{ x: 225, y: 25 }]);
  expect(modelStore.getState().past).toHaveLength(1);
  add();
  press('ArrowRight');
  press('Enter');
  press('ArrowDown', true);
  press('Escape');
  expect(points()).toEqual([{ x: 225, y: 25 }]);
  expect(modelStore.getState().past).toHaveLength(1);
  add();
  press('Tab');
  expect(document.querySelector('[data-chosen]')).toBeNull();
});

it('nudges a focused bend and keeps deletion and actions local to that bend', () => {
  render(<DiagramCanvas />);
  add();
  press('Enter');
  press('ArrowDown');
  press('Enter');
  bend().focus();
  press('ArrowUp', true);
  press('ArrowLeft');
  expect(points()).toEqual([{ x: 205, y: 15 }]);
  fireEvent.click(bend());
  expect(screen.getByRole('button', { name: 'Remove bend' })).toBe(
    document.activeElement,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Move bend' }));
  press('ArrowRight');
  press('Enter');
  expect(points()).toEqual([{ x: 210, y: 15 }]);
  fireEvent.click(bend());
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('group', { name: 'Bend actions' })).toBeNull();
  bend().focus();
  press('Backspace');
  expect(points()).toEqual([]);
  expect(
    modelStore
      .getState()
      .present.diagrams[0].elements.some(
        (element) => element.id === requestFlow,
      ),
  ).toBe(true);
  add();
  press('Enter');
  press('Enter');
  fireEvent.click(bend());
  fireEvent.click(screen.getByRole('button', { name: 'Remove bend' }));
  expect(points()).toEqual([]);
});

it('places and moves with clicks, and drops previews on another selection', () => {
  render(<DiagramCanvas />);
  add();
  const segment = document.querySelector('[data-bend-segment="0"]');
  expect(segment).not.toBeNull();
  fireEvent.click(segment ?? document.body);
  const pane = document.querySelector('.react-flow__pane') ?? document.body;
  fireEvent.pointerDown(pane);
  fireEvent.click(pane, { clientX: 250, clientY: 100 });
  expect(points()).toHaveLength(1);
  fireEvent.click(bend());
  fireEvent.click(screen.getByRole('button', { name: 'Move bend' }));
  fireEvent.click(pane, { clientX: 270, clientY: 120 });
  const committed = modelStore.getState().present;
  add();
  press('Enter');
  press('ArrowUp');
  act(() => {
    dispatch(Action.Select({ elementIds: [readerElement] }));
  });
  expect(screen.queryByRole('button', { name: 'Add bend' })).toBeNull();
  expect(modelStore.getState().present).toBe(committed);
});

it('cancels on a window blur and preserves the flow rename action', () => {
  render(<DiagramCanvas />);
  add();
  press('Enter');
  press('ArrowDown');
  fireEvent.blur(window);
  expect(points()).toEqual([]);
  add();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(points()).toEqual([]);
  const segment = document.querySelector('[data-bend-segment="0"]');
  fireEvent.doubleClick(segment ?? document.body);
  expect(modelStore.getState().inlineEditor).toEqual({
    kind: 'name',
    elementId: requestFlow,
  });
  expect(screen.queryByRole('button', { name: 'Add bend' })).toBeNull();
});

it('pins a flow end to a side by arrow key, by its actions, and by dragging, and releases it', () => {
  render(<DiagramCanvas />);
  expect(
    screen.queryByRole('button', { name: 'Flow target end' }),
  ).not.toBeNull();
  sourceEnd().focus();
  press('ArrowDown');
  expect(source()).toEqual({
    kind: 'attached',
    element: readerElement,
    side: 'bottom',
  });
  expect(modelStore.getState().past).toHaveLength(1);
  press('ArrowDown');
  expect(modelStore.getState().past).toHaveLength(1);
  sourceEnd().focus();
  press('Delete');
  expect(source()).toEqual({ kind: 'attached', element: readerElement });
  fireEvent.click(sourceEnd());
  expect(
    screen.getByRole('group', { name: 'Flow end actions' }),
  ).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Follow the route' })).toBe(
    document.activeElement,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Top' }));
  expect(source()).toMatchObject({ side: 'top' });
  expect(screen.queryByRole('group', { name: 'Flow end actions' })).toBeNull();
  const before = modelStore.getState().present;
  const reader = currentLayout(modelStore.getState()).nodes.find(
    (node) => node.id === readerElement,
  );
  if (reader === undefined) {
    throw new Error('The reader is laid out');
  }
  pointerOn(sourceEnd(), 'pointerdown', 100, 100);
  pointerOn(
    sourceEnd(),
    'pointermove',
    100 + reader.position.x + reader.size.width,
    100 + reader.position.y + reader.size.height / 2,
  );
  expect(modelStore.getState().present).toBe(before);
  pointerOn(
    sourceEnd(),
    'pointerup',
    100 + reader.position.x + reader.size.width,
    100 + reader.position.y + reader.size.height / 2,
  );
  expect(source()).toMatchObject({ side: 'right' });
});
