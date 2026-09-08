import { act, renderHook } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { canvasModel, requestFlow, readerElement } from './canvas.fixtures.js';
import { useFlowBends } from './flow-bends.js';
import { currentLayout } from './layout.js';
import { resetTools, selectTool } from './tools.js';

beforeEach(() => {
  resetTools();
  modelStore.setState(
    { ...initialState(canvasModel), selection: [requestFlow] },
    true,
  );
});

it('previews an insertion without changing saved state, then commits one undoable edit', () => {
  const { result } = renderHook(useFlowBends);
  const before = modelStore.getState();
  const target = {
    kind: 'insert' as const,
    index: 0,
    point: { x: 205, y: 140 },
  };
  act(() => {
    result.current.preview(target);
  });
  expect(
    result.current.layout.edges.find((edge) => edge.id === requestFlow)
      ?.waypoints,
  ).toEqual([target.point]);
  expect(modelStore.getState()).toBe(before);
  act(() => {
    result.current.commit(target);
  });
  const committed = modelStore.getState();
  expect(committed.past).toEqual([before.present]);
  expect(result.current.flow?.waypoints).toEqual([target.point]);
  act(() => {
    dispatch(Action.Undo());
  });
  expect(modelStore.getState().present).toBe(before.present);
  act(() => {
    dispatch(Action.Redo());
  });
  expect(modelStore.getState().present).toBe(committed.present);
  act(() => {
    result.current.remove(0);
  });
  expect(result.current.flow?.waypoints).toEqual([]);
  const empty = modelStore.getState();
  act(() => {
    result.current.remove(0);
  });
  expect(modelStore.getState()).toBe(empty);
});

it('cancels previews and ignores a stale commit after selection or tool changes', () => {
  const { result } = renderHook(useFlowBends);
  const target = {
    kind: 'insert' as const,
    index: 0,
    point: { x: 200, y: 130 },
  };
  const before = modelStore.getState();
  act(() => {
    result.current.preview(target);
  });
  act(() => {
    result.current.cancel();
  });
  expect(result.current.layout).toBe(currentLayout(before));
  expect(modelStore.getState()).toBe(before);
  act(() => {
    result.current.preview(target);
  });
  const stale = result.current.commit;
  act(() => {
    dispatch(Action.Select({ elementIds: [readerElement] }));
    stale(target);
  });
  expect(result.current.flow).toBeUndefined();
  expect(modelStore.getState().present).toBe(before.present);
  act(() => {
    dispatch(Action.Select({ elementIds: [requestFlow] }));
  });
  act(() => {
    result.current.preview(target);
  });
  act(() => {
    selectTool('hand');
  });
  expect(result.current.draft).toBeUndefined();
  expect(modelStore.getState().past).toEqual([]);
});
