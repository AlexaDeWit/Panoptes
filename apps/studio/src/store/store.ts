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
  type RecoverySnapshot,
  type RecoveryStorage,
} from './recovery-storage.js';
import {
  StudioFailure,
  initialState,
  placeholderModel,
  type State,
} from './state.js';

/** A store and its persistence-aware dispatcher. */
export type ModelStoreRuntime = {
  readonly modelStore: StoreApi<State>;
  readonly dispatch: (
    action: Action,
  ) => Either.Either<void, RecoveryStorageFailure>;
};

/** Creates a store that restores and replaces one recovery snapshot. */
export function createModelStore(
  storage: RecoveryStorage,
  fallback = placeholderModel,
): ModelStoreRuntime {
  const modelStore = createStore<State>(() => restoredState(storage, fallback));

  return {
    modelStore,
    dispatch: (action) => {
      const before = modelStore.getState();
      const reduced = reduce(before, action);
      if (!recoverableChanged(before, reduced)) {
        modelStore.setState(reduced, true);
        return Either.right(undefined);
      }

      const stored =
        action._tag === 'Closed'
          ? storage.clear()
          : storage.replace(
              recoverySnapshot(
                reduced.present,
                reduced.present !== reduced.saved,
                reduced.file,
                reduced.activeDiagram,
              ),
            );
      if (Either.isLeft(stored)) {
        const retained = action._tag === 'Closed' ? before : reduced;
        modelStore.setState(
          {
            ...retained,
            recoveryCurrent:
              action._tag === 'Closed' ? before.recoveryCurrent : false,
            lastFailure: StudioFailure.RecoveryUnavailable({
              reason: stored.left.reason,
            }),
          },
          true,
        );
        return stored;
      }
      modelStore.setState(
        {
          ...reduced,
          recoveryCurrent: action._tag !== 'Closed',
        },
        true,
      );
      return Either.right(undefined);
    },
  };
}

const runtime = createModelStore(
  browserRecoveryStorage,
  developmentModel() ?? placeholderModel,
);

/** The studio's one vanilla model store. */
export const modelStore = runtime.modelStore;

/** Reduces an action and returns the recovery storage outcome. */
export const dispatch = runtime.dispatch;

/** Subscribes a component to one store selector. */
export function useModelStore<Selected>(
  select: (state: State) => Selected,
): Selected {
  return useStore(modelStore, select);
}

function restoredState(storage: RecoveryStorage, fallback: Model): State {
  return storage.load().pipe(
    Either.match({
      onLeft: (failure) => ({
        ...initialState(fallback),
        lastFailure: startupFailure(failure),
      }),
      onRight: (snapshot) =>
        snapshot === undefined
          ? initialState(fallback)
          : stateFromSnapshot(snapshot),
    }),
  );
}

function stateFromSnapshot(snapshot: RecoverySnapshot): State {
  const present = snapshot.present;
  // Dirty status uses identity, so dirty recovery needs a distinct saved value.
  return {
    ...initialState(present),
    saved: snapshot.dirty ? { ...present } : present,
    activeDiagram: present.diagrams.some(
      (diagram) => diagram.id === snapshot.activeDiagram,
    )
      ? snapshot.activeDiagram
      : undefined,
    file: snapshot.file,
    recoveryCurrent: true,
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
