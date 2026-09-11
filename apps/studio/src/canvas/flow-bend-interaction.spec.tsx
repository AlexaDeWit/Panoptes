import { act, renderHook } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { useRef } from 'react';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { canvasModel, requestFlow, readerElement } from './canvas.fixtures.js';
import { useFlowBendInteraction } from './flow-bend-interaction.js';
import { useFlowBends } from './flow-bends.js';
import { resetTools } from './tools.js';

const button = document.createElement('button');
const pointer = (x: number, y: number, pointerId = 1) => ({
  button: 0,
  clientX: x,
  clientY: y,
  currentTarget: button,
  isPrimary: true,
  pointerId,
  stopPropagation: vi.fn<() => void>(),
});
const target = { kind: 'insert' as const, index: 0, point: { x: 200, y: 30 } };
const renderBends = () =>
  renderHook(
    () => {
      const bends = useFlowBends();
      const toolbar = useRef<HTMLFieldSetElement>(null);
      return {
        bends,
        controls: useFlowBendInteraction(
          bends,
          bends.layout.edges.find((edge) => edge.id === requestFlow),
          toolbar,
        ),
      };
    },
    { wrapper: ReactFlowProvider },
  );

beforeEach(() => {
  resetTools();
  modelStore.setState(
    { ...initialState(canvasModel), selection: [requestFlow] },
    true,
  );
});

it('holds a drag outside history until release, then moves that bend independently', () => {
  const { result } = renderBends();
  const before = modelStore.getState().present;
  act(() => {
    result.current.controls.down(pointer(100, 100), target);
  });
  act(() => {
    result.current.controls.move(pointer(102, 101));
  });
  expect(result.current.bends.draft).toBeUndefined();
  act(() => {
    result.current.controls.move(pointer(140, 160, 2));
  });
  expect(result.current.bends.draft).toBeUndefined();
  act(() => {
    result.current.controls.move(pointer(140, 160));
  });
  expect(result.current.bends.draft).toMatchObject({
    point: { x: 240, y: 90 },
  });
  expect(modelStore.getState().present).toBe(before);
  act(() => {
    result.current.controls.up(pointer(140, 160, 2));
  });
  expect(modelStore.getState().present).toBe(before);
  act(() => {
    result.current.controls.up(pointer(140, 160));
  });
  expect(result.current.bends.flow?.waypoints).toEqual([{ x: 240, y: 90 }]);
  expect(modelStore.getState().past).toHaveLength(1);
  act(() => {
    result.current.controls.down(pointer(140, 160), {
      kind: 'move',
      index: 0,
      point: { x: 240, y: 90 },
    });
  });
  act(() => {
    result.current.controls.move(pointer(150, 180));
  });
  act(() => {
    result.current.controls.up(pointer(150, 180));
  });
  expect(result.current.bends.flow?.waypoints).toEqual([{ x: 250, y: 110 }]);
  expect(modelStore.getState().past).toHaveLength(2);
});

it('ignores secondary pointers, stationary clicks, and returned drags', () => {
  const { result } = renderBends();
  act(() => {
    result.current.controls.down({ ...pointer(100, 100), button: 2 }, target);
  });
  act(() => {
    result.current.controls.move(pointer(140, 160));
    result.current.controls.up(pointer(140, 160));
  });
  expect(result.current.bends.flow?.waypoints).toEqual([]);
  act(() => {
    result.current.controls.down(pointer(100, 100), target);
    result.current.controls.up(pointer(100, 100));
  });
  expect(modelStore.getState().past).toHaveLength(0);
  act(() => {
    result.current.controls.down(pointer(100, 100), target);
  });
  act(() => {
    result.current.controls.move(pointer(140, 160));
  });
  act(() => {
    result.current.controls.up(pointer(100, 100));
  });
  expect(result.current.bends.draft).toBeUndefined();
  expect(modelStore.getState().past).toHaveLength(0);
});

it('cancels a pointer gesture and rejects its release after the selection changes', () => {
  const { result } = renderBends();
  act(() => {
    result.current.controls.down(pointer(100, 100), target);
  });
  act(() => {
    result.current.controls.move(pointer(140, 160));
  });
  act(() => {
    result.current.controls.cancel();
  });
  act(() => {
    result.current.controls.up(pointer(140, 160));
  });
  expect(result.current.bends.draft).toBeUndefined();
  expect(modelStore.getState().past).toHaveLength(0);
  act(() => {
    result.current.controls.down(pointer(100, 100), target);
  });
  act(() => {
    dispatch(Action.Select({ elementIds: [readerElement] }));
  });
  act(() => {
    result.current.controls.move(pointer(140, 160));
    result.current.controls.up(pointer(140, 160));
  });
  expect(modelStore.getState().past).toHaveLength(0);
});
