import { act, renderHook } from '@testing-library/react';
import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { useBackgroundSelection } from './background-selection.js';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';
import { resetTools, selectTool } from './tools.js';

const actor = placeholderModel.diagrams[0].elements[0].id;
const pane = document.createElement('div');
pane.className = 'react-flow__pane';
const event = {
  pointerId: 1,
  isPrimary: true,
  button: 0,
  clientX: 10,
  clientY: 10,
  target: pane,
};

beforeEach(() => {
  resetTools();
  resetAnnouncements();
  modelStore.setState(
    { ...initialState(placeholderModel), selection: [actor] },
    true,
  );
});

it.each(['select', 'hand'] as const)(
  'clears selection in %s without changing the model or history',
  (tool) => {
    if (tool === 'hand') {
      selectTool(tool);
    }
    const { result } = renderHook(useBackgroundSelection);
    act(() => {
      result.current.down(event);
      result.current.up(event);
    });
    expect(modelStore.getState().selection).toEqual([]);
    expect(modelStore.getState().present).toBe(placeholderModel);
    expect(modelStore.getState().past).toEqual([]);
    expect(currentAnnouncement().message).toContain('cleared');
  },
);

it('preserves selection after a pan even when the pointer returns to its starting point', () => {
  const { result } = renderHook(useBackgroundSelection);
  act(() => {
    result.current.down(event);
    result.current.move({ ...event, clientX: 40 });
    result.current.up(event);
  });
  expect(modelStore.getState().selection).toEqual([actor]);
});

it('does not interpret a second touch or cancelled gesture as a tap', () => {
  const { result } = renderHook(useBackgroundSelection);
  act(() => {
    result.current.down(event);
    result.current.down({ ...event, isPrimary: false, pointerId: 2 });
    result.current.up(event);
  });
  expect(modelStore.getState().selection).toEqual([actor]);
  act(() => {
    result.current.down(event);
    result.current.cancel();
    result.current.up(event);
  });
  expect(modelStore.getState().selection).toEqual([actor]);
});

it('leaves placement and presses that change tools alone', () => {
  const { result } = renderHook(useBackgroundSelection);
  act(() => {
    result.current.down(event);
    selectTool('actor');
    result.current.up(event);
  });
  expect(modelStore.getState().selection).toEqual([actor]);
  act(() => {
    result.current.down(event);
    result.current.up(event);
  });
  expect(modelStore.getState().selection).toEqual([actor]);
});
