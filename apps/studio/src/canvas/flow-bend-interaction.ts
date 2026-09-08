import {
  keyboardResizeStep,
  shiftedKeyboardResizeStep,
  type CanvasEdge,
} from '@saerskriven/canvas';
import type { Point } from '@saerskriven/model';
import { useReactFlow } from '@xyflow/react';
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from 'react';
import { keyboardOwner } from '../commands/binding.js';
import { pressesContextualShortcut } from '../commands/contextual-shortcuts.js';
import { hostPlatform, type ChordEvent } from '../commands/shortcuts.js';
import { announce } from './announcements.js';
import { bendInsertionEvent } from './bend-insertion.js';
import { focusElement } from './edits.js';
import type { BendTarget, FlowBends } from './flow-bends.js';

type BendMode =
  | { readonly kind: 'choose'; readonly index: number }
  | { readonly kind: 'place'; readonly target: BendTarget }
  | { readonly kind: 'actions'; readonly index: number };

type Gesture = {
  readonly context: FlowBends['context'];
  readonly target: BendTarget;
  readonly start: Point;
  readonly pointerId: number;
  readonly moved: boolean;
};

type BendPointer = Pick<
  PointerEvent<HTMLButtonElement | SVGPathElement>,
  | 'button'
  | 'clientX'
  | 'clientY'
  | 'currentTarget'
  | 'isPrimary'
  | 'pointerId'
  | 'stopPropagation'
>;

/** The midpoint used by keyboard insertion on a chosen route segment. */
export function segmentBend(edge: CanvasEdge, index: number): BendTarget {
  const points = [edge.source, ...edge.waypoints, edge.target];
  const from = points[index];
  const to = points[index + 1];
  return {
    kind: 'insert',
    index,
    point: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
  };
}

/** Moves a point by the canvas keyboard step, or ignores another key. */
export function nudgedBend(point: Point, event: ChordEvent): Point | undefined {
  const far = pressesContextualShortcut('move-bend-far', event, hostPlatform);
  if (!far && !pressesContextualShortcut('move-bend', event, hostPlatform)) {
    return undefined;
  }
  const step = far ? shiftedKeyboardResizeStep : keyboardResizeStep;
  switch (event.key) {
    case 'ArrowLeft':
      return { x: point.x - step, y: point.y };
    case 'ArrowRight':
      return { x: point.x + step, y: point.y };
    case 'ArrowUp':
      return { x: point.x, y: point.y - step };
    case 'ArrowDown':
      return { x: point.x, y: point.y + step };
    default:
      return undefined;
  }
}

/** Binds route gestures while preserving the settled model until commit. */
export function useFlowBendInteraction(
  bends: FlowBends,
  edge: CanvasEdge | undefined,
  toolbar: RefObject<HTMLFieldSetElement | null>,
) {
  const view = useReactFlow();
  const gesture = useRef<Gesture | undefined>(undefined);
  const suppressClick = useRef(false);
  const [mode, setMode] = useState<BendMode | undefined>();
  const [owner, setOwner] = useState(bends.context);
  if (owner !== bends.context) {
    setOwner(bends.context);
    setMode(undefined);
  }

  const handBack = (): void => {
    if (bends.flow !== undefined) {
      focusElement(bends.flow.id);
    }
  };
  const cancel = (focus = true): void => {
    if (gesture.current !== undefined) {
      suppressClick.current = true;
    }
    gesture.current = undefined;
    setMode(undefined);
    bends.cancel();
    if (focus) {
      handBack();
    }
  };
  const choose = (index: number): void => {
    setMode({ kind: 'choose', index });
    announce(
      `Segment ${String(index + 1)}. Use Left or Right to choose a segment, then Enter.`,
    );
  };
  const place = (target: BendTarget): void => {
    setMode({ kind: 'place', target });
    bends.preview(target);
    announce(
      'Use arrow keys or click a position. Enter confirms. Escape cancels.',
    );
  };
  const commit = (target: BendTarget): void => {
    bends.commit(target);
    setMode(undefined);
    handBack();
  };
  const remove = (index: number): void => {
    bends.remove(index);
    setMode(undefined);
    handBack();
  };
  const begin = useEffectEvent((): void => {
    if (edge !== undefined && bends.flow !== undefined) {
      bends.cancel();
      choose(0);
      toolbar.current?.focus();
    }
  });
  const keyDown = useEffectEvent((event: globalThis.KeyboardEvent): void => {
    if (
      bends.flow === undefined ||
      edge === undefined ||
      keyboardOwner(event.target) !== 'page'
    ) {
      return;
    }
    if (
      !(event.target instanceof Element) ||
      event.target.closest('[data-testid="canvas-container"]') === null
    ) {
      return;
    }
    if (
      pressesContextualShortcut('cancel-bend', event, hostPlatform) &&
      (mode !== undefined || gesture.current !== undefined)
    ) {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    if (event.key === 'Tab' && mode !== undefined && mode.kind !== 'actions') {
      cancel(false);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (mode?.kind === 'choose') {
      if (
        pressesContextualShortcut('choose-bend-segment', event, hostPlatform)
      ) {
        choose(
          Math.max(
            0,
            Math.min(
              edge.waypoints.length,
              mode.index + (event.key === 'ArrowLeft' ? -1 : 1),
            ),
          ),
        );
      } else if (
        pressesContextualShortcut('commit-bend', event, hostPlatform)
      ) {
        place(segmentBend(edge, mode.index));
      } else {
        return;
      }
    } else if (mode?.kind === 'place') {
      const point = nudgedBend(mode.target.point, event);
      if (point !== undefined) {
        const target = { ...mode.target, point };
        setMode({ kind: 'place', target });
        bends.preview(target);
        announce(`Bend at ${String(point.x)}, ${String(point.y)}.`);
      } else if (
        pressesContextualShortcut('commit-bend', event, hostPlatform)
      ) {
        commit(mode.target);
      } else {
        return;
      }
    } else {
      const handle = event.target.closest('[data-bend-index]');
      if (handle === null) {
        return;
      }
      const index = Number(handle.getAttribute('data-bend-index'));
      const point = bends.flow.waypoints[index];
      if (point === undefined) {
        return;
      }
      const moved = nudgedBend(point, event);
      if (moved !== undefined) {
        bends.commit({ kind: 'move', index, point: moved });
      } else if (
        pressesContextualShortcut('remove-bend', event, hostPlatform)
      ) {
        remove(index);
      } else {
        return;
      }
    }
    event.preventDefault();
    event.stopPropagation();
  });
  const clicked = useEffectEvent((event: globalThis.MouseEvent): void => {
    if (suppressClick.current) {
      suppressClick.current = false;
      if (
        event.target instanceof Element &&
        event.target.closest('[data-bend-index], [data-bend-segment]') !== null
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    if (
      mode === undefined ||
      edge === undefined ||
      !(event.target instanceof Element)
    ) {
      return;
    }
    if (
      event.target.closest('button, input, textarea, [data-bend-toolbar]') !==
      null
    ) {
      return;
    }
    if (event.target.closest('.react-flow') === null) {
      return;
    }
    if (mode.kind === 'choose') {
      const segment = event.target.closest('[data-bend-segment]');
      if (segment === null) {
        return;
      }
      const index = Number(segment.getAttribute('data-bend-segment'));
      place(segmentBend(edge, index));
    } else if (mode.kind === 'place') {
      commit({
        ...mode.target,
        point: view.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
      });
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  });
  const pointerStarted = useEffectEvent(
    (event: globalThis.PointerEvent): void => {
      if (mode?.kind !== 'place' || !(event.target instanceof Element)) {
        return;
      }
      if (
        event.target.closest('button, input, textarea, [data-bend-toolbar]') !==
        null
      ) {
        return;
      }
      if (event.target.closest('.react-flow') !== null) {
        event.stopPropagation();
      }
    },
  );
  const blurred = useEffectEvent((): void => {
    cancel(false);
  });
  useEffect(() => {
    document.addEventListener(bendInsertionEvent, begin);
    document.addEventListener('keydown', keyDown, true);
    document.addEventListener('click', clicked, true);
    document.addEventListener('pointerdown', pointerStarted, true);
    window.addEventListener('blur', blurred);
    return () => {
      document.removeEventListener(bendInsertionEvent, begin);
      document.removeEventListener('keydown', keyDown, true);
      document.removeEventListener('click', clicked, true);
      document.removeEventListener('pointerdown', pointerStarted, true);
      window.removeEventListener('blur', blurred);
    };
  }, []);

  const movedTarget = (event: BendPointer, started: Gesture): BendTarget => {
    const from = view.screenToFlowPosition(started.start);
    const at = view.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    return {
      ...started.target,
      point: {
        x: started.target.point.x + at.x - from.x,
        y: started.target.point.y + at.y - from.y,
      },
    };
  };
  return {
    mode,
    cancel,
    remove,
    place,
    actions: (index: number): void => {
      if (mode?.kind === 'place') {
        commit(mode.target);
        return;
      }
      if (mode?.kind === 'choose') {
        return;
      }
      setMode({ kind: 'actions', index });
    },
    down: (event: BendPointer, target: BendTarget): void => {
      if (
        mode?.kind === 'place' ||
        mode?.kind === 'choose' ||
        event.button !== 0 ||
        !event.isPrimary
      ) {
        return;
      }
      suppressClick.current = false;
      setMode(undefined);
      gesture.current = {
        context: bends.context,
        target,
        start: { x: event.clientX, y: event.clientY },
        pointerId: event.pointerId,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.stopPropagation();
    },
    move: (event: BendPointer): void => {
      const started = gesture.current;
      if (
        started === undefined ||
        started.context !== bends.context ||
        started.pointerId !== event.pointerId
      ) {
        return;
      }
      if (
        !started.moved &&
        Math.hypot(
          event.clientX - started.start.x,
          event.clientY - started.start.y,
        ) < 3
      ) {
        return;
      }
      gesture.current = { ...started, moved: true };
      bends.preview(movedTarget(event, started));
    },
    up: (event: BendPointer): void => {
      const started = gesture.current;
      if (
        started === undefined ||
        started.context !== bends.context ||
        started.pointerId !== event.pointerId
      ) {
        return;
      }
      gesture.current = undefined;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (started.moved) {
        suppressClick.current = true;
        if (
          Math.hypot(
            event.clientX - started.start.x,
            event.clientY - started.start.y,
          ) < 3
        ) {
          cancel();
        } else {
          commit(movedTarget(event, started));
        }
      }
    },
  };
}
