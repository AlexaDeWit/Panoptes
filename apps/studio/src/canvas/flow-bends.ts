import {
  reconnectFlow,
  setFlowWaypoints,
  type Flow,
  type Model,
  type OperationFailure,
  type Point,
  type Side,
} from '@saerskriven/model';
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

/** One attached end of a flow, pinned to a side of its element or released to follow the route. */
export type AnchorTarget = {
  readonly kind: 'anchor';
  readonly end: 'source' | 'target';
  readonly side: Side | undefined;
};

/** One edit of a flow's route: a bend, or the side an end attaches at. */
export type RouteTarget = BendTarget | AnchorTarget;

type RouteDraft = RouteTarget & {
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

/** The model with one route edit applied: what a preview draws and a commit dispatches. */
export function editedRoute(
  model: Model,
  flow: Flow,
  target: RouteTarget,
): Either.Either<Model, OperationFailure> {
  if (target.kind !== 'anchor') {
    return setFlowWaypoints(model, flow.id, editedBends(flow, target));
  }
  const end = flow[target.end];
  return end.kind === 'attached'
    ? reconnectFlow(model, flow.id, target.end, end.element, target.side)
    : Either.right(model);
}

function routeAction(flow: Flow, target: RouteTarget): Action | undefined {
  if (target.kind !== 'anchor') {
    return Action.SetFlowWaypoints({
      elementId: flow.id,
      waypoints: editedBends(flow, target),
    });
  }
  const end = flow[target.end];
  return end.kind === 'attached'
    ? Action.ReconnectFlow({
        elementId: flow.id,
        side: target.end,
        endpointId: end.element,
        anchor: target.side,
      })
    : undefined;
}

function routeAnnouncement(flow: Flow, target: RouteTarget): string {
  if (target.kind !== 'anchor') {
    return `${target.kind === 'insert' ? 'Added' : 'Moved'} bend ${String(target.index + 1)} on ${flow.name}.`;
  }
  return target.side === undefined
    ? `Released the ${target.end} of ${flow.name} to follow its route.`
    : `Pinned the ${target.end} of ${flow.name} to the ${target.side} side.`;
}

function currentDraft(draft: RouteDraft): boolean {
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

/** Owns a transient route preview, a bend or an end's side, and commits one edit per gesture. */
export function useFlowBends() {
  const state = useModelStore((value) => value);
  const tool = useTool();
  const [held, setHeld] = useState<RouteDraft | undefined>();
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
        : editedRoute(state.present, draft.flow, draft),
    [state.present, draft],
  );
  const present =
    outcome !== undefined && Either.isRight(outcome)
      ? outcome.right
      : state.present;

  const commit = (target: RouteTarget): void => {
    if (
      flow === undefined ||
      modelStore.getState().present !== state.present ||
      selectedElement(modelStore.getState()) !== flow.id ||
      currentTool().transition !== tool.transition ||
      (held !== undefined && !currentDraft(held))
    ) {
      return;
    }
    const action = routeAction(flow, target);
    if (action === undefined) {
      return;
    }
    const before = modelStore.getState().present;
    dispatch(action);
    setHeld(undefined);
    if (modelStore.getState().present !== before) {
      announce(routeAnnouncement(flow, target));
    }
  };

  return {
    context,
    flow,
    draft,
    layout: currentLayout({ present }),
    preview: (target: RouteTarget): void => {
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
