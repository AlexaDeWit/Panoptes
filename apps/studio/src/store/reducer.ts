import {
  addElement,
  addThreat,
  attachThreat,
  detachThreat,
  moveElement,
  removeElement,
  removeThreat,
  replaceThreat,
  resizeElement,
  type ElementId,
  type Model,
  type OperationFailure,
} from '@panoptes/model';
import { Either } from 'effect';
import type { Action } from './actions.js';
import { FileLifecycle, initialState, type State } from './state.js';

/**
 * The one place the studio's state changes. Every arm is total: an operation
 * the model refuses leaves the present, the past and the future as they
 * were and records why, so no dispatch can fail and no caller has a failure
 * to handle.
 *
 * The switch is exhaustive over {@link Action}. A tag with no arm reaches
 * {@link unmatchedAction}, which takes `never`, so the omission is a compile
 * error.
 */
export function reduce(state: State, action: Action): State {
  switch (action._tag) {
    case 'AddElement':
      return edited(
        state,
        addElement(state.present, action.diagramId, action.element),
      );
    case 'RemoveElement':
      return removedElement(state, action.elementId);
    case 'MoveElement':
      return edited(
        state,
        moveElement(state.present, action.elementId, action.offset),
      );
    case 'ResizeElement':
      return edited(
        state,
        resizeElement(state.present, action.elementId, action.size),
      );
    case 'AddThreat':
      return edited(state, addThreat(state.present, action.threat));
    case 'RemoveThreat':
      return edited(state, removeThreat(state.present, action.threatId));
    case 'ReplaceThreat':
      return edited(state, replaceThreat(state.present, action.threat));
    case 'AttachThreat':
      return edited(
        state,
        attachThreat(state.present, action.threatId, action.elementId),
      );
    case 'DetachThreat':
      return edited(
        state,
        detachThreat(state.present, action.threatId, action.elementId),
      );
    case 'Undo':
      return undone(state);
    case 'Redo':
      return redone(state);
    case 'Select':
      return { ...state, selection: action.elementId };
    case 'Opened':
      return {
        ...initialState(action.model),
        file: FileLifecycle.Opened({
          name: action.name,
          format: action.format,
        }),
      };
    case 'Saved':
      return { ...state, saved: state.present };
    default:
      return unmatchedAction(action, state);
  }
}

/**
 * Where a tag no arm claimed would land. The action parameter is `never`,
 * so an action added to the union without an arm beside it stops the
 * compiler here. The state comes back unchanged, the reducer being total.
 */
export function unmatchedAction(action: never, state: State): State {
  return state;
}

function edited(
  state: State,
  outcome: Either.Either<Model, OperationFailure>,
): State {
  return Either.match(outcome, {
    onLeft: (failure) => ({ ...state, lastFailure: failure }),
    onRight: (present) => ({
      ...state,
      present,
      past: [...state.past, state.present],
      future: [],
      lastFailure: undefined,
    }),
  });
}

function removedElement(state: State, elementId: ElementId): State {
  const outcome = removeElement(state.present, elementId);
  const next = edited(state, outcome);
  return Either.isRight(outcome) && next.selection === elementId
    ? { ...next, selection: undefined }
    : next;
}

function undone(state: State): State {
  const previous = state.past.at(-1);
  return previous === undefined
    ? state
    : {
        ...state,
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
        lastFailure: undefined,
      };
}

function redone(state: State): State {
  const next = state.future.at(0);
  return next === undefined
    ? state
    : {
        ...state,
        present: next,
        past: [...state.past, state.present],
        future: state.future.slice(1),
        lastFailure: undefined,
      };
}
