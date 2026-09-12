import type { Model } from '@saerskriven/model';
import { Either } from 'effect';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Action } from './actions.js';
import { developmentModel } from './development-model.js';
import { reduce } from './reducer.js';
import {
  browserRecoveryStorage,
  RecoveryStorageFailure,
  recoverySnapshot,
  restoredState,
  type RecoveryStorage,
} from './recovery-storage.js';
import {
  StudioFailure,
  initialState,
  placeholderModel,
  type State,
} from './state.js';
import { browserStoreSync, type StoreSync, type SyncedState } from './sync.js';

/** A store and its persistence-aware dispatcher. */
export type ModelStoreRuntime = {
  readonly modelStore: StoreApi<State>;
  readonly dispatch: (
    action: Action,
  ) => Either.Either<void, RecoveryStorageFailure>;
};

/**
 * Creates a store that restores and replaces one recovery snapshot and
 * publishes every changed result to the other tabs. A followed result is
 * theirs already, so following neither writes nor publishes.
 */
export function createModelStore(
  storage: RecoveryStorage,
  sync: StoreSync,
  fallback = placeholderModel,
): ModelStoreRuntime {
  const modelStore = createStore<State>(() => startState(storage, fallback));

  const dispatch = (
    action: Action,
  ): Either.Either<void, RecoveryStorageFailure> => {
    const before = modelStore.getState();
    const reduced = reduce(before, action);
    const followed = action._tag === 'Followed';
    const stored =
      followed || !recoverableChanged(before, reduced)
        ? undefined
        : action._tag === 'Closed'
          ? storage.clear()
          : storage.replace(
              recoverySnapshot(
                reduced.present,
                reduced.present !== reduced.saved,
                reduced.file,
                reduced.activeDiagram,
              ),
            );
    const next = settled(before, reduced, action, stored);
    modelStore.setState(next, true);
    if (!followed && resultChanged(before, next)) {
      sync.publish(syncedState(next));
    }
    return stored ?? Either.right(undefined);
  };

  return { modelStore, dispatch };
}

const runtime = createModelStore(
  browserRecoveryStorage,
  browserStoreSync,
  developmentModel() ?? placeholderModel,
);

/** The studio's one vanilla model store. */
export const modelStore = runtime.modelStore;

/** Reduces an action and returns the recovery storage outcome. */
export const dispatch = runtime.dispatch;

/**
 * Runs `changed` whenever an action moves the model on screen, the selection,
 * or the open inline field. Returns the unsubscribe.
 */
export function onCanvasOrPanelChange(changed: () => void): () => void {
  return modelStore.subscribe((state, previous) => {
    if (
      state.present !== previous.present ||
      state.selection !== previous.selection ||
      state.inlineEditor !== previous.inlineEditor
    ) {
      changed();
    }
  });
}

/** Subscribes a component to one store selector. */
export function useModelStore<Selected>(
  select: (state: State) => Selected,
): Selected {
  return useStore(modelStore, select);
}

function startState(storage: RecoveryStorage, fallback: Model): State {
  return storage.load().pipe(
    Either.match({
      onLeft: (failure) => ({
        ...initialState(fallback),
        lastFailure: startupFailure(failure),
      }),
      onRight: (snapshot) =>
        snapshot === undefined
          ? initialState(fallback)
          : restoredState(snapshot),
    }),
  );
}

function settled(
  before: State,
  reduced: State,
  action: Action,
  stored: Either.Either<void, RecoveryStorageFailure> | undefined,
): State {
  if (stored === undefined) {
    return reduced;
  }
  const closing = action._tag === 'Closed';
  if (Either.isLeft(stored)) {
    return {
      ...(closing ? before : reduced),
      recoveryCurrent: closing ? before.recoveryCurrent : false,
      lastFailure: StudioFailure.RecoveryUnavailable({
        reason: stored.left.reason,
      }),
    };
  }
  return { ...reduced, recoveryCurrent: !closing };
}

function syncedState(state: State): SyncedState {
  return {
    present: state.present,
    past: state.past,
    future: state.future,
    saved: state.saved,
    file: state.file,
    recoveryCurrent: state.recoveryCurrent,
  };
}

function startupFailure(failure: RecoveryStorageFailure): StudioFailure {
  return RecoveryStorageFailure.$match(failure, {
    Rejected: ({ reason }) => StudioFailure.StoredRecoveryRejected({ reason }),
    Unavailable: ({ reason }) => StudioFailure.RecoveryUnavailable({ reason }),
  });
}

function recoverableChanged(before: State, after: State): boolean {
  return (
    before.present !== after.present ||
    (before.present !== before.saved) !== (after.present !== after.saved) ||
    before.file !== after.file ||
    before.activeDiagram !== after.activeDiagram
  );
}

function resultChanged(before: State, after: State): boolean {
  return (
    before.present !== after.present ||
    before.past !== after.past ||
    before.future !== after.future ||
    before.saved !== after.saved ||
    before.file !== after.file
  );
}
