import { emptyModel } from '@panoptes/model';
import { Action } from './actions.js';
import { reduce } from './reducer.js';
import {
  canRedo,
  canUndo,
  elementCount,
  firstDiagramId,
  isDirty,
} from './selectors.js';
import { initialState } from './state.js';
import { mainDiagram, newProcess, sampleModel } from './store.fixtures.js';

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

  it('names no diagram in a model that holds none', () => {
    expect(firstDiagramId(start)).toBe(mainDiagram);
    expect(firstDiagramId(initialState(emptyModel))).toBeUndefined();
  });
});
