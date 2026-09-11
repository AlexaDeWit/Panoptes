import {
  addElement,
  insertFragment,
  reconnectFlow,
  addThreat,
  attachThreat,
  detachThreat,
  editNote,
  moveElement,
  removeElement,
  removeThreat,
  renameElement,
  replaceThreat,
  resizeElement,
  setFlowDirection,
  setFlowWaypoints,
  OperationFailure,
  type DiagramId,
  type ElementId,
  type Model,
} from '@saerskriven/model';
import { Either } from 'effect';
import { sameSelection } from './selection.js';
import { Action } from './actions.js';
import { activeDiagramId } from './selectors.js';
import {
  FileLifecycle,
  StudioFailure,
  initialState,
  placeholderModel,
  type State,
} from './state.js';

/** Refused model operations preserve the model and history, and record the failure. */
export function reduce(state: State, action: Action): State {
  return Action.$match(action, {
    InsertFragment: ({ diagramId, fragment }) =>
      edited(state, insertFragment(state.present, diagramId, fragment)),
    ReconnectFlow: ({ elementId, side, endpointId, anchor }) =>
      edited(
        state,
        reconnectFlow(state.present, elementId, side, endpointId, anchor),
      ),
    SetFlowDirection: ({ elementId, bidirectional }) =>
      edited(state, setFlowDirection(state.present, elementId, bidirectional)),
    ArrangeElements: ({ moves }) =>
      edited(
        state,
        moves.reduce<Either.Either<Model, OperationFailure>>(
          (outcome, { elementId, offset }) =>
            Either.flatMap(outcome, (model) =>
              offset.x === 0 && offset.y === 0
                ? Either.right(model)
                : moveElement(model, elementId, offset),
            ),
          Either.right(state.present),
        ),
      ),
    AddElement: ({ diagramId, element }) =>
      edited(state, addElement(state.present, diagramId, element)),
    RemoveElement: ({ elementId }) => removedElement(state, elementId),
    RemoveElements: ({ elementIds }) => removedElements(state, elementIds),
    MoveElement: ({ elementId, offset }) =>
      edited(state, moveElement(state.present, elementId, offset)),
    MoveElements: ({ elementIds, offset }) =>
      edited(
        state,
        editElements(state.present, elementIds, (model, elementId) =>
          moveElement(model, elementId, offset),
        ),
      ),
    ResizeElement: ({ elementId, offset, size }) =>
      edited(
        state,
        Either.flatMap(moveElement(state.present, elementId, offset), (moved) =>
          resizeElement(moved, elementId, size),
        ),
      ),
    RenameElement: ({ elementId, name }) =>
      edited(state, renameElement(state.present, elementId, name)),
    EditNote: ({ elementId, text }) =>
      edited(state, editNote(state.present, elementId, text)),
    SetFlowWaypoints: ({ elementId, waypoints }) =>
      edited(state, setFlowWaypoints(state.present, elementId, waypoints)),
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
    SelectDiagram: ({ diagramId }) => selectedDiagram(state, diagramId),
    Select: ({ elementIds }) => {
      const selection = [...new Set(elementIds)];
      return sameSelection(state.selection, selection)
        ? state
        : { ...state, selection };
    },
    InlineEditing: ({ editor }) => ({ ...state, inlineEditor: editor }),
    Opened: ({ model, name, source }) => ({
      ...initialState(model),
      file: FileLifecycle.Opened({ name, source }),
    }),
    Imported: ({ model, name }) => ({
      ...initialState(model),
      saved: { ...model },
      file: FileLifecycle.Opened({
        name,
        source: { format: 'saerskriven-yaml', document: undefined },
      }),
    }),
    ImportFailed: ({ name, failure }) => ({
      ...state,
      lastFailure: StudioFailure.Read({ name, failure }),
    }),
    Saved: ({ name, source }) => ({
      ...state,
      saved: state.present,
      file: FileLifecycle.Opened({ name, source }),
      lastFailure: undefined,
    }),
    Closed: () => initialState(placeholderModel),
    ReadFailed: ({ name, failure }) => ({
      ...state,
      file: FileLifecycle.NoFile(),
      lastFailure: StudioFailure.Read({ name, failure }),
    }),
    FileRefused: ({ operation, reason }) => ({
      ...state,
      file: operation === 'open' ? FileLifecycle.NoFile() : state.file,
      lastFailure: StudioFailure.File({ reason }),
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
    onRight: (present) =>
      present === state.present
        ? state
        : {
            ...state,
            present,
            past: [...state.past, state.present],
            future: [],
            lastFailure: undefined,
          },
  });
}

function selectedDiagram(state: State, diagramId: DiagramId): State {
  if (!state.present.diagrams.some((diagram) => diagram.id === diagramId)) {
    return {
      ...state,
      lastFailure: StudioFailure.Operation({
        failure: OperationFailure.UnknownDiagram({ diagramId }),
      }),
    };
  }
  if (diagramId === activeDiagramId(state)) {
    return state;
  }
  return {
    ...state,
    activeDiagram: diagramId,
    selection: state.selection.length === 0 ? state.selection : [],
    inlineEditor: undefined,
  };
}

function removedElement(state: State, elementId: ElementId): State {
  const outcome = removeElement(state.present, elementId);
  const next = edited(state, outcome);
  if (Either.isLeft(outcome)) {
    return next;
  }
  return {
    ...next,
    selection: next.selection.filter((selected) => selected !== elementId),
    inlineEditor:
      next.inlineEditor?.elementId === elementId
        ? undefined
        : next.inlineEditor,
  };
}

function removedElements(
  state: State,
  elementIds: readonly ElementId[],
): State {
  const removed = new Set(elementIds);
  if (removed.size === 0) {
    return state;
  }
  const outcome = editElements(state.present, [...removed], removeElement);
  const next = edited(state, outcome);
  if (Either.isLeft(outcome)) {
    return next;
  }
  return {
    ...next,
    selection: next.selection.filter((selected) => !removed.has(selected)),
    inlineEditor:
      next.inlineEditor !== undefined &&
      removed.has(next.inlineEditor.elementId)
        ? undefined
        : next.inlineEditor,
  };
}

function editElements(
  model: Model,
  elementIds: readonly ElementId[],
  edit: (
    current: Model,
    elementId: ElementId,
  ) => Either.Either<Model, OperationFailure>,
): Either.Either<Model, OperationFailure> {
  return [...new Set(elementIds)].reduce<
    Either.Either<Model, OperationFailure>
  >(
    (outcome, elementId) =>
      Either.flatMap(outcome, (current) => edit(current, elementId)),
    Either.right(model),
  );
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
