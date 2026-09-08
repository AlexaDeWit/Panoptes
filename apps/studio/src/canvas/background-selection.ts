import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import { announce } from './announcements.js';
import { placementClickDistance } from './elements.js';
import { currentConnecting } from './connecting.js';
import { currentTool } from './tools.js';

type BackgroundPointer = Pick<
  PointerEvent<HTMLDivElement>,
  'pointerId' | 'isPrimary' | 'button' | 'clientX' | 'clientY' | 'target'
>;

/** Recognizes a stationary background press without consuming placement or pan events. */
export function useBackgroundSelection() {
  const press = useRef<
    | {
        pointerId: number;
        x: number;
        y: number;
        transition: number;
      }
    | undefined
  >(undefined);

  const cancel = useCallback(() => {
    press.current = undefined;
  }, []);

  useEffect(() => {
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('blur', cancel);
    };
  }, [cancel]);

  return {
    cancel,
    down(event: BackgroundPointer) {
      const tool = currentTool();
      if (
        currentConnecting().open ||
        press.current !== undefined ||
        !event.isPrimary ||
        event.button !== 0 ||
        (tool.active !== 'select' && tool.active !== 'hand') ||
        !(event.target instanceof Element) ||
        !event.target.matches('.react-flow__pane')
      ) {
        cancel();
        return;
      }
      press.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        transition: tool.transition,
      };
    },
    move(event: BackgroundPointer) {
      const start = press.current;
      if (
        start !== undefined &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) >=
          placementClickDistance
      ) {
        cancel();
      }
    },
    up(event: BackgroundPointer) {
      const start = press.current;
      cancel();
      if (
        start === undefined ||
        start.pointerId !== event.pointerId ||
        start.transition !== currentTool().transition ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) >=
          placementClickDistance ||
        !(event.target instanceof Element) ||
        !event.target.matches('.react-flow__pane') ||
        modelStore.getState().selection.length === 0
      ) {
        return;
      }
      const canvas = event.target.closest<HTMLElement>('.react-flow');
      dispatch(Action.Select({ elementIds: [] }));
      canvas?.focus({ preventScroll: true });
      announce('Selection cleared.');
    },
  };
}
