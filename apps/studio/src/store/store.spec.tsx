import { act, render, screen } from '@testing-library/react';
import { Either } from 'effect';
import { useEffect } from 'react';
import { Action } from './actions.js';
import {
  actorElement,
  foreignSource,
  nativeSource,
  mainDiagram,
  newProcess,
  sampleModel,
  secondDiagram,
  twoDiagramModel,
} from './store.fixtures.js';
import {
  activeDiagramId,
  elementCount,
  isDirty,
  needsCloseGuard,
} from './selectors.js';
import {
  RecoveryStorageFailure,
  recoverySnapshot,
  type RecoverySnapshot,
  type RecoveryStorage,
} from './recovery-storage.js';
import type { StoreSync, SyncedState } from './sync.js';
import { FileLifecycle, initialState, placeholderModel } from './state.js';
import {
  createModelStore,
  dispatch,
  modelStore,
  useModelStore,
} from './store.js';

const painted: number[] = [];

function ElementCount() {
  const count = useModelStore(elementCount);
  useEffect(() => {
    painted.push(count);
  });
  return <span data-testid="count">{count}</span>;
}

const addProcess = Action.AddElement({
  diagramId: mainDiagram,
  element: newProcess('process-added', 'Added'),
});

describe('the model store', () => {
  beforeEach(() => {
    modelStore.setState(initialState(sampleModel), true);
    painted.length = 0;
  });

  it('shows a dispatched edit through a selector, with nothing invalidated by hand', () => {
    render(<ElementCount />);
    expect(screen.getByTestId('count').textContent).toBe('3');
    act(() => {
      dispatch(addProcess);
    });
    expect(screen.getByTestId('count').textContent).toBe('4');
    act(() => {
      dispatch(Action.Undo());
    });
    expect(screen.getByTestId('count').textContent).toBe('3');
  });

  it('leaves a component alone while a slice it does not read moves', () => {
    render(<ElementCount />);
    expect(painted).toEqual([3]);
    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement] }));
    });
    expect(painted).toEqual([3]);
    act(() => {
      dispatch(addProcess);
    });
    expect(painted).toEqual([3, 4]);
  });
});

const loaded = (snapshot?: RecoverySnapshot): RecoveryStorage => ({
  load: () => Either.right(snapshot),
  replace: () => Either.right(undefined),
  clear: () => Either.right(undefined),
});

const silent: StoreSync = {
  publish: () => undefined,
  watch: () => () => undefined,
};

function tabs(snapshot?: RecoverySnapshot) {
  const writes = { replaced: 0, cleared: 0 };
  const published: SyncedState[] = [];
  const storage: RecoveryStorage = {
    ...loaded(snapshot),
    replace: () => {
      writes.replaced += 1;
      return Either.right(undefined);
    },
    clear: () => {
      writes.cleared += 1;
      return Either.right(undefined);
    },
  };
  const sync: StoreSync = {
    ...silent,
    publish: (state) => {
      published.push(state);
    },
  };
  return { storage, sync, writes, published };
}

describe('session recovery', () => {
  it.each([false, true])(
    'restores a session whose dirty status is %s with empty transient state',
    (dirty) => {
      const file = FileLifecycle.Opened({
        name: 'model.json',
        source: foreignSource,
      });
      const runtime = createModelStore(
        loaded(recoverySnapshot(sampleModel, dirty, file)),
        silent,
        placeholderModel,
      );
      const state = runtime.modelStore.getState();

      expect(state.present).toEqual(sampleModel);
      expect(isDirty(state)).toBe(dirty);
      expect(state.file).toEqual(file);
      expect(state.past).toEqual([]);
      expect(state.future).toEqual([]);
      expect(state.selection).toEqual([]);
      expect(state.inlineEditor).toBeUndefined();
      expect(state.lastFailure).toBeUndefined();
      expect(state.recoveryCurrent).toBe(true);
    },
  );

  it('restores the diagram on screen where the restored model holds it', () => {
    const shown = createModelStore(
      loaded(
        recoverySnapshot(
          twoDiagramModel,
          false,
          FileLifecycle.NoFile(),
          secondDiagram,
        ),
      ),
      silent,
    ).modelStore.getState();
    expect(activeDiagramId(shown)).toBe(secondDiagram);

    const stale = createModelStore(
      loaded(
        recoverySnapshot(
          sampleModel,
          false,
          FileLifecycle.NoFile(),
          secondDiagram,
        ),
      ),
      silent,
    ).modelStore.getState();
    expect(stale.activeDiagram).toBeUndefined();
    expect(activeDiagramId(stale)).toBe(mainDiagram);
  });

  it('replaces recovery when the diagram on screen changes', () => {
    let stored: RecoverySnapshot | undefined;
    const storage: RecoveryStorage = {
      ...loaded(),
      replace: (snapshot) => {
        stored = snapshot;
        return Either.right(undefined);
      },
    };
    const runtime = createModelStore(storage, silent, twoDiagramModel);

    runtime.dispatch(Action.SelectDiagram({ diagramId: secondDiagram }));

    expect(stored?.activeDiagram).toBe(secondDiagram);
    expect(stored?.dirty).toBe(false);
  });

  it('keeps the diagram on screen to this tab, publishing no result for a switch', () => {
    const tab = tabs();
    const runtime = createModelStore(tab.storage, tab.sync, twoDiagramModel);

    runtime.dispatch(Action.SelectDiagram({ diagramId: secondDiagram }));

    expect(tab.writes.replaced).toBe(1);
    expect(tab.published).toEqual([]);
  });

  it('opens the placeholder and reports rejected stored data', () => {
    const storage: RecoveryStorage = {
      ...loaded(),
      load: () =>
        Either.left(
          RecoveryStorageFailure.Rejected({ reason: 'Unsupported version.' }),
        ),
    };

    const state = createModelStore(storage, silent).modelStore.getState();

    expect(state.present).toBe(placeholderModel);
    expect(state.lastFailure?._tag).toBe('StoredRecoveryRejected');
  });

  it('replaces recovery before publishing a recoverable state change', () => {
    let runtime: ReturnType<typeof createModelStore>;
    let stored: RecoverySnapshot | undefined;
    const storage: RecoveryStorage = {
      ...loaded(),
      replace: (snapshot) => {
        expect(runtime.modelStore.getState().present).toBe(sampleModel);
        stored = snapshot;
        return Either.right(undefined);
      },
    };
    runtime = createModelStore(storage, silent, sampleModel);

    runtime.dispatch(addProcess);

    expect(stored?.present.diagrams[0].elements).toHaveLength(4);
    expect(runtime.modelStore.getState().recoveryCurrent).toBe(true);
  });

  it('does not replace recovery for transient selection state', () => {
    let replacements = 0;
    const storage: RecoveryStorage = {
      ...loaded(),
      replace: () => {
        replacements += 1;
        return Either.right(undefined);
      },
    };
    const runtime = createModelStore(storage, silent, sampleModel);

    runtime.dispatch(Action.Select({ elementIds: [actorElement] }));

    expect(replacements).toBe(0);
  });

  it('guards a dirty session after a later recovery write fails', () => {
    let replacements = 0;
    const storage: RecoveryStorage = {
      ...loaded(),
      replace: () => {
        replacements += 1;
        return replacements === 1
          ? Either.right(undefined)
          : Either.left(
              RecoveryStorageFailure.Unavailable({ reason: 'Quota reached.' }),
            );
      },
    };
    const runtime = createModelStore(storage, silent, sampleModel);

    runtime.dispatch(addProcess);
    expect(needsCloseGuard(runtime.modelStore.getState())).toBe(false);
    runtime.dispatch(
      Action.RenameElement({ elementId: actorElement, name: 'Changed' }),
    );

    const state = runtime.modelStore.getState();
    expect(isDirty(state)).toBe(true);
    expect(needsCloseGuard(state)).toBe(true);
    expect(state.lastFailure).toEqual(
      expect.objectContaining({ _tag: 'RecoveryUnavailable' }),
    );
  });

  it('publishes each changed result to the other tabs, and nothing for a transient change', () => {
    const tab = tabs();
    const runtime = createModelStore(tab.storage, tab.sync, sampleModel);

    runtime.dispatch(Action.Select({ elementIds: [actorElement] }));
    runtime.dispatch(addProcess);
    runtime.dispatch(Action.Undo());

    expect(tab.published.map((state) => state.past.length)).toEqual([1, 0]);
    expect(tab.published[0]?.present).toBe(
      runtime.modelStore.getState().future[0],
    );
    expect(tab.published[1]?.recoveryCurrent).toBe(true);
  });

  it('publishes a result whose recovery write failed, so the other tabs guard it too', () => {
    const tab = tabs();
    tab.storage = {
      ...tab.storage,
      replace: () =>
        Either.left(
          RecoveryStorageFailure.Unavailable({ reason: 'Quota reached.' }),
        ),
    };
    const runtime = createModelStore(tab.storage, tab.sync, sampleModel);

    runtime.dispatch(addProcess);

    expect(tab.published).toHaveLength(1);
    expect(tab.published[0]?.recoveryCurrent).toBe(false);
  });

  it('publishes a save, which moves the saved point and the file, and a close', () => {
    const tab = tabs();
    const runtime = createModelStore(tab.storage, tab.sync, sampleModel);
    runtime.dispatch(addProcess);
    const file = FileLifecycle.Opened({
      name: 'model.yaml',
      source: nativeSource,
    });

    runtime.dispatch(
      Action.Saved({ name: 'model.yaml', source: nativeSource }),
    );
    runtime.dispatch(Action.Closed());

    const [, saved, closed] = tab.published;
    expect(saved?.saved).toBe(saved?.present);
    expect(saved?.file).toEqual(file);
    expect(closed?.present).toBe(placeholderModel);
    expect(closed?.file).toEqual(FileLifecycle.NoFile());
    expect(tab.published).toHaveLength(3);
  });

  it('follows another tab without writing or publishing, since the result is already theirs', () => {
    const tab = tabs();
    const runtime = createModelStore(tab.storage, tab.sync, placeholderModel);
    const file = FileLifecycle.Opened({
      name: 'model.json',
      source: foreignSource,
    });
    const theirs = {
      ...initialState(sampleModel),
      past: [placeholderModel],
      saved: placeholderModel,
      file,
      recoveryCurrent: true,
    };

    runtime.dispatch(Action.Followed({ state: theirs }));

    const state = runtime.modelStore.getState();
    expect(state.present).toBe(sampleModel);
    expect(state.past).toBe(theirs.past);
    expect(isDirty(state)).toBe(true);
    expect(state.file).toEqual(file);
    expect(state.recoveryCurrent).toBe(true);
    expect(tab.writes).toEqual({ replaced: 0, cleared: 0 });
    expect(tab.published).toEqual([]);
  });

  it('clears recovery when the session closes', () => {
    let clears = 0;
    const storage: RecoveryStorage = {
      ...loaded(recoverySnapshot(sampleModel, true, FileLifecycle.NoFile())),
      clear: () => {
        clears += 1;
        return Either.right(undefined);
      },
    };
    const runtime = createModelStore(storage, silent);

    runtime.dispatch(Action.Closed());

    expect(clears).toBe(1);
    expect(runtime.modelStore.getState().recoveryCurrent).toBe(false);
  });

  it('keeps the session available until a failed clear succeeds', () => {
    let clears = 0;
    const file = FileLifecycle.Opened({
      name: 'model.json',
      source: foreignSource,
    });
    const storage: RecoveryStorage = {
      ...loaded(recoverySnapshot(sampleModel, true, file)),
      clear: () => {
        clears += 1;
        return clears === 1
          ? Either.left(
              RecoveryStorageFailure.Unavailable({ reason: 'Clear failed.' }),
            )
          : Either.right(undefined);
      },
    };
    const runtime = createModelStore(storage, silent);

    expect(runtime.dispatch(Action.Closed())._tag).toBe('Left');
    const retained = runtime.modelStore.getState();
    expect(retained.present).toEqual(sampleModel);
    expect(retained.file).toEqual(file);
    expect(isDirty(retained)).toBe(true);
    expect(retained.lastFailure?._tag).toBe('RecoveryUnavailable');

    expect(runtime.dispatch(Action.Closed())).toEqual(Either.right(undefined));
    expect(runtime.modelStore.getState().present).toBe(placeholderModel);
    expect(runtime.modelStore.getState().file).toEqual(FileLifecycle.NoFile());
  });
});
