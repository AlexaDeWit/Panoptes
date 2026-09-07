import { act, render, screen } from '@testing-library/react';
import { Either } from 'effect';
import { useEffect } from 'react';
import { Action } from './actions.js';
import {
  actorElement,
  foreignSource,
  mainDiagram,
  newProcess,
  sampleModel,
} from './store.fixtures.js';
import { elementCount, isDirty, needsCloseGuard } from './selectors.js';
import {
  RecoveryStorageFailure,
  recoverySnapshot,
  type RecoverySnapshot,
  type RecoveryStorage,
} from './recovery-storage.js';
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

  it('opens the placeholder and reports rejected stored data', () => {
    const storage: RecoveryStorage = {
      ...loaded(),
      load: () =>
        Either.left(
          RecoveryStorageFailure.Rejected({ reason: 'Unsupported version.' }),
        ),
    };

    const state = createModelStore(storage).modelStore.getState();

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
    runtime = createModelStore(storage, sampleModel);

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
    const runtime = createModelStore(storage, sampleModel);

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
    const runtime = createModelStore(storage, sampleModel);

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

  it('clears recovery when the session closes', () => {
    let clears = 0;
    const storage: RecoveryStorage = {
      ...loaded(recoverySnapshot(sampleModel, true, FileLifecycle.NoFile())),
      clear: () => {
        clears += 1;
        return Either.right(undefined);
      },
    };
    const runtime = createModelStore(storage);

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
    const runtime = createModelStore(storage);

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
