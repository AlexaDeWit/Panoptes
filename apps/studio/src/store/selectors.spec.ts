import { emptyModel } from '@panoptes/model';
import { Action } from './actions.js';
import { reduce } from './reducer.js';
import {
  canRedo,
  canUndo,
  elementCount,
  firstDiagramId,
  isDirty,
  modelAsOpened,
} from './selectors.js';
import { initialState } from './state.js';
import {
  mainDiagram,
  nativeSource,
  newProcess,
  sampleModel,
} from './store.fixtures.js';

const start = initialState(sampleModel);

const edited = reduce(
  start,
  Action.AddElement({
    diagramId: mainDiagram,
    element: newProcess('process-added', 'Added'),
  }),
);

describe('selectors', () => {
  it('counts the elements of every diagram', () => {
    expect(elementCount(start)).toBe(3);
    expect(elementCount(edited)).toBe(4);
  });

  it('reads unsaved work off identity, so an undo to the saved model clears it', () => {
    expect(isDirty(start)).toBe(false);
    expect(isDirty(edited)).toBe(true);
    expect(isDirty(reduce(edited, Action.Undo()))).toBe(false);
  });

  it('offers undo and redo only where there is a model to move to', () => {
    expect(canUndo(start)).toBe(false);
    expect(canRedo(start)).toBe(false);
    expect(canUndo(edited)).toBe(true);
    expect(canRedo(reduce(edited, Action.Undo()))).toBe(true);
  });

  it('reads the model as it arrived, and nothing at all once the history has moved', () => {
    expect(modelAsOpened(start)).toBe(sampleModel);
    expect(modelAsOpened(edited)).toBeUndefined();
    expect(modelAsOpened(reduce(edited, Action.Undo()))).toBeUndefined();
  });

  it('holds the model a save leaves alone, so a save does not fit the view again', () => {
    const saved = reduce(
      start,
      Action.Saved({ name: 'model.yaml', source: nativeSource }),
    );

    expect(modelAsOpened(saved)).toBe(sampleModel);
  });

  it('reads a newly opened model, so a second open fits the view again', () => {
    const opened = reduce(
      edited,
      Action.Opened({
        model: sampleModel,
        name: 'other.yaml',
        source: nativeSource,
        divergences: [],
      }),
    );

    expect(modelAsOpened(opened)).toBe(sampleModel);
  });

  it('names no diagram in a model that holds none', () => {
    expect(firstDiagramId(start)).toBe(mainDiagram);
    expect(firstDiagramId(initialState(emptyModel))).toBeUndefined();
  });
});
