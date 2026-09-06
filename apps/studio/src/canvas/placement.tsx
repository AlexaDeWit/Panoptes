import { smoothPath, type CanvasFlowEdge } from '@saerskriven/canvas';
import type { Point } from '@saerskriven/model';
import { ViewportPortal, type ReactFlowInstance } from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { keyboardOwner } from '../commands/binding.js';
import { placeBoundaryCurve, placeElement } from './edits.js';
import {
  centredPlacement,
  defaultCurveWaypoints,
  pointerPlacement,
  type ElementTool,
} from './elements.js';
import type { DiagramNode } from './nodes.js';
import {
  finishPlacement,
  isElementTool,
  useTool,
  type ToolState,
} from './tools.js';
import styles from './placement.module.css';

const noPoints: readonly Point[] = [];

type BoxTool = Exclude<ElementTool, 'boundary-curve'>;

type PlacementGesture = {
  readonly pointerId: number;
  readonly tool: BoxTool;
  readonly screen: Point;
  readonly flow: Point;
};

type CurveDraft = {
  readonly revision: number;
  readonly waypoints: readonly Point[];
  readonly pointer: Point | undefined;
};

/** The active mode and event handlers for placement gestures. */
export type PlacementControls = {
  readonly mode: ToolState;
  readonly preview: readonly Point[];
  readonly click: (event: MouseEvent<HTMLDivElement>) => boolean;
  readonly pointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  readonly pointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  readonly pointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  readonly pointerCancel: () => void;
};

/** Connects toolbox modes to pointer and Enter placement gestures. */
export function usePlacement(
  surface: RefObject<HTMLDivElement | null>,
  view: RefObject<ReactFlowInstance<DiagramNode, CanvasFlowEdge> | null>,
): PlacementControls {
  const mode = useTool();
  const [curveDraft, setCurveDraft] = useState<CurveDraft>({
    revision: mode.revision,
    waypoints: [],
    pointer: undefined,
  });
  const curve =
    curveDraft.revision === mode.revision ? curveDraft.waypoints : noPoints;
  const curvePointer =
    curveDraft.revision === mode.revision ? curveDraft.pointer : undefined;
  const gesture = useRef<PlacementGesture | undefined>(undefined);

  const clearCurve = useCallback((): void => {
    setCurveDraft({
      revision: mode.revision,
      waypoints: [],
      pointer: undefined,
    });
  }, [mode.revision]);

  const commitCurve = useCallback(
    (waypoints: readonly Point[]): void => {
      if (placeBoundaryCurve(waypoints)) {
        clearCurve();
        finishPlacement();
      }
    },
    [clearCurve],
  );

  const placeDefault = useCallback(
    (tool: ElementTool, centre: Point): void => {
      const geometry = centredPlacement(tool, centre);
      const placed =
        tool === 'boundary-curve'
          ? placeBoundaryCurve(defaultCurveWaypoints(centre))
          : placeElement(tool, geometry.position, geometry.size);
      if (placed) {
        clearCurve();
        finishPlacement();
      }
    },
    [clearCurve],
  );

  useEffect(() => {
    const active = mode.active;
    if (!isElementTool(active)) {
      return undefined;
    }
    const pressed = (event: globalThis.KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        event.key !== 'Enter' ||
        keyboardOwner(event.target) !== 'page'
      ) {
        return;
      }
      const extent = surface.current?.getBoundingClientRect();
      const instance = view.current;
      if (extent === undefined || instance === null) {
        return;
      }
      event.preventDefault();
      if (active === 'boundary-curve' && curve.length >= 2) {
        commitCurve(curve);
        return;
      }
      placeDefault(
        active,
        instance.screenToFlowPosition({
          x: extent.left + extent.width / 2,
          y: extent.top + extent.height / 2,
        }),
      );
    };
    document.addEventListener('keydown', pressed);
    return () => {
      document.removeEventListener('keydown', pressed);
    };
  }, [commitCurve, curve, mode.active, placeDefault, surface, view]);

  const screenToFlow = (x: number, y: number): Point | undefined =>
    view.current?.screenToFlowPosition({ x, y });

  const click = (event: MouseEvent<HTMLDivElement>): boolean => {
    if (mode.active !== 'boundary-curve') {
      return mode.active !== 'select';
    }
    if (
      !(event.target instanceof Element) ||
      event.target.closest('.react-flow') === null
    ) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) {
      commitCurve(curve);
      return true;
    }
    const point = screenToFlow(event.clientX, event.clientY);
    if (point !== undefined) {
      setCurveDraft((current) => ({
        revision: mode.revision,
        waypoints: [
          ...(current.revision === mode.revision ? current.waypoints : []),
          point,
        ],
        pointer: undefined,
      }));
    }
    return true;
  };

  const pointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (
      event.button !== 0 ||
      !event.isPrimary ||
      !isBoxTool(mode.active) ||
      !(event.target instanceof Element) ||
      event.target.closest('input, textarea, button, a') !== null ||
      event.target.closest('.react-flow') === null
    ) {
      return;
    }
    const flow = screenToFlow(event.clientX, event.clientY);
    if (flow === undefined) {
      return;
    }
    gesture.current = {
      pointerId: event.pointerId,
      tool: mode.active,
      screen: { x: event.clientX, y: event.clientY },
      flow,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  const pointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (
      mode.active !== 'boundary-curve' ||
      !(event.target instanceof Element) ||
      event.target.closest('.react-flow') === null
    ) {
      return;
    }
    const point = screenToFlow(event.clientX, event.clientY);
    setCurveDraft((current) => ({
      revision: mode.revision,
      waypoints:
        current.revision === mode.revision ? current.waypoints : noPoints,
      pointer: point,
    }));
  };

  const pointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const started = gesture.current;
    if (started === undefined || started.pointerId !== event.pointerId) {
      return;
    }
    gesture.current = undefined;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    const end = screenToFlow(event.clientX, event.clientY);
    if (end === undefined) {
      return;
    }
    const geometry = pointerPlacement(
      started.tool,
      started.flow,
      end,
      Math.hypot(
        event.clientX - started.screen.x,
        event.clientY - started.screen.y,
      ),
    );
    if (placeElement(started.tool, geometry.position, geometry.size)) {
      finishPlacement();
    }
  };

  return {
    mode,
    preview: curvePointer === undefined ? curve : [...curve, curvePointer],
    click,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel: () => {
      gesture.current = undefined;
    },
  };
}

/** The boundary curve route shown before it reaches the model. */
export function PlacementPreview({
  points,
}: {
  readonly points: readonly Point[];
}) {
  if (points.length === 0) {
    return null;
  }
  return (
    <ViewportPortal>
      <svg
        aria-hidden="true"
        className={styles.curve}
        data-testid="curve-draft"
      >
        <path d={smoothPath(points)} />
        {points.map((point, index) => (
          <circle cx={point.x} cy={point.y} key={index} r="3" />
        ))}
      </svg>
    </ViewportPortal>
  );
}

function isBoxTool(tool: string): tool is BoxTool {
  return (
    tool === 'actor' ||
    tool === 'process' ||
    tool === 'store' ||
    tool === 'boundary-box'
  );
}
