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
import { Action } from './actions.js';
import {
  FileLifecycle,
  StudioFailure,
  initialState,
  type State,
} from './state.js';

/**
 * The one place the studio's state changes. Every arm is total: an operation
 * the model refuses leaves the present, the past and the future as they
 * were and records why, so no dispatch can fail and no caller has a failure
 * to handle.
 *
 * Effect's `$match` takes one arm per member of {@link Action} and the type
 * of the cases object names every tag, so a tag added to the union without
 * an arm beside it is a compile error.
 */
export function reduce(state: State, action: Action): State {
  return Action.$match(action, {
    AddElement: ({ diagramId, element }) =>
      edited(state, addElement(state.present, diagramId, element)),
    RemoveElement: ({ elementId }) => removedElement(state, elementId),
    MoveElement: ({ elementId, offset }) =>
      edited(state, moveElement(state.present, elementId, offset)),
    ResizeElement: ({ elementId, size }) =>
      edited(state, resizeElement(state.present, elementId, size)),
    AddThreat: ({ threat }) => edited(state, addThreat(state.present, threat)),
    RemoveThreat: ({ threatId }) =>
      edited(state, removeThreat(state.present, threatId)),
    ReplaceThreat: ({ threat }) =>
      edited(state, replaceThreat(state.present, threat)),
    AttachThreat: ({ threatId, elementId }) =>
      edited(state, attachThreat(state.present, threatId, elementId)),
    DetachThreat: ({ threatId, elementId }) =>
      edited(state, detachThreat(state.present, threatId, elementId)),
    Undo: () => undone(state),
    Redo: () => redone(state),
    Select: ({ elementId }) => ({ ...state, selection: elementId }),
    Opened: ({ model, name, format }) => ({
      ...initialState(model),
      file: FileLifecycle.Opened({ name, format }),
    }),
    Saved: ({ name, format }) => ({
      ...state,
      saved: state.present,
      file: FileLifecycle.Opened({ name, format }),
    }),
  });
}

function edited(
  state: State,
  outcome: Either.Either<Model, OperationFailure>,
): State {
  return Either.match(outcome, {
    onLeft: (failure) => ({
      ...state,
      lastFailure: StudioFailure.Operation({ failure }),
    }),
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
