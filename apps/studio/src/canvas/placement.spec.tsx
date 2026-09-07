import type { CanvasFlowEdge, CanvasLayout } from '@saerskriven/canvas';
import type { Point } from '@saerskriven/model';
import type { ReactFlowInstance } from '@xyflow/react';
import { act, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { canvasModel } from './canvas.fixtures.js';
import { currentLayout } from './layout.js';
import type { DiagramNode } from './nodes.js';
import { usePlacement, type PlacementControls } from './placement.js';
import { resetTools, selectTool } from './tools.js';

type ViewTransform = {
  readonly pan: Point;
  readonly zoom: number;
};

const surface = document.createElement('div');
const pane = document.createElement('div');
pane.className = 'react-flow';
surface.append(pane);

const surfaceRef: RefObject<HTMLDivElement | null> = { current: surface };

const viewAt = (
  transform: ViewTransform,
): Pick<
  ReactFlowInstance<DiagramNode, CanvasFlowEdge>,
  'screenToFlowPosition'
> => ({
  screenToFlowPosition: ({ x, y }: Point): Point => ({
    x: (x - transform.pan.x) / transform.zoom,
    y: (y - transform.pan.y) / transform.zoom,
  }),
});

const pointer = (at: Point, pointerId = 1) => ({
  button: 0,
  clientX: at.x,
  clientY: at.y,
  currentTarget: surface,
  isPrimary: true,
  pointerId,
  preventDefault: vi.fn<() => void>(),
  stopPropagation: vi.fn<() => void>(),
  target: pane,
});

const renderPlacement = (
  transform: ViewTransform = { pan: { x: 0, y: 0 }, zoom: 1 },
  layout: CanvasLayout = currentLayout(modelStore.getState()),
) => {
  const viewRef: RefObject<Pick<
    ReactFlowInstance<DiagramNode, CanvasFlowEdge>,
    'screenToFlowPosition'
  > | null> = { current: viewAt(transform) };
  return renderHook(
    ({ current }) => usePlacement(surfaceRef, viewRef, current),
    { initialProps: { current: layout } },
  );
};

const boxPreview = (controls: PlacementControls) => {
  expect(controls.preview?.kind).toBe('box');
  return controls.preview?.kind === 'box' ? controls.preview : undefined;
};

const elementCount = (): number =>
  modelStore.getState().present.diagrams[0].elements.length;

describe('box placement gestures', () => {
  beforeEach(() => {
    modelStore.setState(initialState(canvasModel), true);
    resetTools();
    selectTool('actor');
  });

  it('shows the default on press, updates it on movement, and commits the last preview', () => {
    const { result } = renderPlacement();

    act(() => {
      result.current.pointerDown(pointer({ x: 100, y: 80 }));
    });
    expect(boxPreview(result.current)).toMatchObject({
      position: { x: 40, y: 50 },
      size: { width: 120, height: 60 },
    });

    act(() => {
      result.current.pointerMove(pointer({ x: 180, y: 140 }));
    });
    const shown = boxPreview(result.current);
    expect(shown).toMatchObject({
      position: { x: 100, y: 80 },
      size: { width: 80, height: 60 },
    });

    act(() => {
      result.current.pointerUp(pointer({ x: 999, y: 999 }));
    });

    expect(result.current.preview).toBeUndefined();
    expect(
      modelStore.getState().present.diagrams[0].elements.at(-1),
    ).toMatchObject({
      kind: 'actor',
      position: shown?.position,
      size: shown?.size,
    });
    expect(modelStore.getState().past).toHaveLength(1);
  });

  it('drops a cancelled gesture without an element or undo step', () => {
    const { result } = renderPlacement();
    const before = elementCount();

    act(() => {
      result.current.pointerDown(pointer({ x: 100, y: 80 }));
      result.current.pointerMove(pointer({ x: 180, y: 140 }));
      result.current.pointerCancel();
      result.current.pointerUp(pointer({ x: 180, y: 140 }));
    });

    expect(result.current.preview).toBeUndefined();
    expect(elementCount()).toBe(before);
    expect(modelStore.getState().past).toHaveLength(0);
  });

  it('drops a gesture when Escape changes the tool', () => {
    const { result } = renderPlacement();
    const before = elementCount();

    act(() => {
      result.current.pointerDown(pointer({ x: 100, y: 80 }));
      result.current.pointerMove(pointer({ x: 180, y: 140 }));
    });
    act(() => {
      selectTool('select');
    });
    expect(result.current.preview).toBeUndefined();

    act(() => {
      result.current.pointerUp(pointer({ x: 180, y: 140 }));
    });
    expect(elementCount()).toBe(before);
    expect(modelStore.getState().past).toHaveLength(0);
  });

  it('drops a gesture when another model replaces its layout', () => {
    const firstLayout = currentLayout(modelStore.getState());
    const { result, rerender } = renderPlacement(undefined, firstLayout);
    const before = elementCount();

    act(() => {
      result.current.pointerDown(pointer({ x: 100, y: 80 }));
      result.current.pointerMove(pointer({ x: 180, y: 140 }));
    });
    modelStore.setState(initialState(placeholderModel), true);
    rerender({ current: currentLayout(modelStore.getState()) });

    expect(result.current.preview).toBeUndefined();
    act(() => {
      result.current.pointerUp(pointer({ x: 180, y: 140 }));
    });
    expect(elementCount()).toBe(3);
    expect(modelStore.getState().past).toHaveLength(0);
    expect(before).toBe(6);
  });

  it('gives the same model geometry through pan and zoom', () => {
    const from = { x: 40, y: 60 };
    const to = { x: 140, y: 110 };
    const previewAt = (transform: ViewTransform) => {
      const screen = (point: Point): Point => ({
        x: point.x * transform.zoom + transform.pan.x,
        y: point.y * transform.zoom + transform.pan.y,
      });
      const rendered = renderPlacement(transform);
      act(() => {
        rendered.result.current.pointerDown(pointer(screen(from)));
        rendered.result.current.pointerMove(pointer(screen(to)));
      });
      const preview = boxPreview(rendered.result.current);
      act(() => {
        rendered.result.current.pointerCancel();
      });
      rendered.unmount();
      return preview;
    };

    expect(previewAt({ pan: { x: 0, y: 0 }, zoom: 1 })).toEqual(
      previewAt({ pan: { x: 300, y: -80 }, zoom: 2 }),
    );
  });
});
