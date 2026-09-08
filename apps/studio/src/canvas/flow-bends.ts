import { setFlowWaypoints, type Flow, type Point } from '@saerskriven/model';
import { Either } from 'effect';
import { useMemo, useState } from 'react';
import { Action } from '../store/actions.js';
import { elementById, selectedElement } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { announce } from './announcements.js';
import { currentLayout } from './layout.js';
import { currentTool, useTool } from './tools.js';

/** An insertion slot or an existing bend in source-to-target order. */
export type BendTarget = {
  readonly kind: 'insert' | 'move';
  readonly index: number;
  readonly point: Point;
};

type BendDraft = BendTarget & {
  readonly state: State;
  readonly transition: number;
  readonly flow: Flow;
};

/** Inserts or replaces one route point without changing its neighbours. */
export function editedBends(flow: Flow, target: BendTarget): Point[] {
  return [
    ...flow.waypoints.slice(0, target.index),
    target.point,
    ...flow.waypoints.slice(target.index + (target.kind === 'move' ? 1 : 0)),
  ];
}

function currentDraft(draft: BendDraft): boolean {
  const state = modelStore.getState();
  const tool = currentTool();
  return (
    state.present === draft.state.present &&
    selectedElement(state) === draft.flow.id &&
    state.inlineEditor === draft.state.inlineEditor &&
    tool.active === 'select' &&
    tool.transition === draft.transition
  );
}

/** Owns a transient bend preview and commits one route edit per gesture. */
export function useFlowBends() {
  const state = useModelStore((value) => value);
  const tool = useTool();
  const [held, setHeld] = useState<BendDraft | undefined>();
  const selected = selectedElement(state);
  const element =
    selected === undefined ? undefined : elementById(state, selected);
  const flow =
    tool.active === 'select' &&
    state.inlineEditor === undefined &&
    element?.kind === 'flow'
      ? element
      : undefined;
  const context = useMemo(
    () => ({ flow, model: state.present, transition: tool.transition }),
    [flow, state.present, tool.transition],
  );
  const draft = held !== undefined && currentDraft(held) ? held : undefined;
  if (held !== undefined && draft === undefined) {
    setHeld(undefined);
  }
  const outcome = useMemo(
    () =>
      draft === undefined
        ? undefined
        : setFlowWaypoints(
            state.present,
            draft.flow.id,
            editedBends(draft.flow, draft),
          ),
    [state.present, draft],
  );
  const present =
    outcome !== undefined && Either.isRight(outcome)
      ? outcome.right
      : state.present;

  const commit = (target: BendTarget): void => {
    if (
      flow === undefined ||
      modelStore.getState().present !== state.present ||
      selectedElement(modelStore.getState()) !== flow.id ||
      currentTool().transition !== tool.transition ||
      (held !== undefined && !currentDraft(held))
    ) {
      return;
    }
    const before = modelStore.getState().present;
    dispatch(
      Action.SetFlowWaypoints({
        elementId: flow.id,
        waypoints: editedBends(flow, target),
      }),
    );
    setHeld(undefined);
    if (modelStore.getState().present !== before) {
      announce(
        `${target.kind === 'insert' ? 'Added' : 'Moved'} bend ${String(target.index + 1)} on ${flow.name}.`,
      );
    }
  };

  return {
    context,
    flow,
    draft,
    layout: currentLayout({ present }),
    preview: (target: BendTarget): void => {
      if (flow !== undefined) {
        setHeld({ ...target, state, transition: tool.transition, flow });
      }
    },
    commit,
    cancel: (): void => {
      setHeld(undefined);
    },
    remove: (index: number): void => {
      if (flow === undefined || flow.waypoints[index] === undefined) {
        return;
      }
      dispatch(
        Action.SetFlowWaypoints({
          elementId: flow.id,
          waypoints: flow.waypoints.filter((_point, at) => at !== index),
        }),
      );
      setHeld(undefined);
      announce(`Removed bend ${String(index + 1)} from ${flow.name}.`);
    },
  };
}

/** The state and operations exposed to the bend controls. */
export type FlowBends = ReturnType<typeof useFlowBends>;
