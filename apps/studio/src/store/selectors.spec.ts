import { emptyModel } from '@saerskriven/model';
import { Action } from './actions.js';
import { reduce } from './reducer.js';
import {
  activeDiagram,
  activeDiagramId,
  canRedo,
  canUndo,
  elementCount,
  isDirty,
  modelAsOpened,
  selectedElement,
  selectedElements,
  severalDiagrams,
  showingPlaceholder,
  windowTitle,
} from './selectors.js';
import { initialState, placeholderModel } from './state.js';
import {
  actorElement,
  mainDiagram,
  nativeSource,
  newProcess,
  processElement,
  sampleModel,
  secondDiagram,
  twoDiagramModel,
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

  it('shows the first diagram until one is chosen, and none in a model that holds none', () => {
    expect(activeDiagramId(start)).toBe(mainDiagram);
    expect(activeDiagramId(initialState(emptyModel))).toBeUndefined();
    expect(severalDiagrams(start)).toBe(false);
  });

  it('shows the diagram chosen while the model holds it, and the first again once it does not', () => {
    const chosen = {
      ...initialState(twoDiagramModel),
      activeDiagram: secondDiagram,
    };
    expect(severalDiagrams(chosen)).toBe(true);
    expect(activeDiagram(chosen)?.title).toBe('Second');
    expect(activeDiagramId({ ...chosen, present: sampleModel })).toBe(
      mainDiagram,
    );
  });

  it('reads one selected element and keeps the full selection', () => {
    const one = reduce(start, Action.Select({ elementIds: [actorElement] }));
    const several = reduce(
      one,
      Action.Select({ elementIds: [actorElement, processElement] }),
    );

    expect(selectedElement(one)).toBe(actorElement);
    expect(selectedElements(several)).toEqual([actorElement, processElement]);
    expect(selectedElement(several)).toBeUndefined();
  });
});

describe('showingPlaceholder', () => {
  const opening = initialState(placeholderModel);

  const opened = Action.Opened({
    model: sampleModel,
    name: 'other.yaml',
    source: nativeSource,
    divergences: [],
  });

  const saved = Action.Saved({ name: 'model.yaml', source: nativeSource });

  const added = Action.AddElement({
    diagramId: placeholderModel.diagrams[0].id,
    element: newProcess('process-added', 'Added'),
  });

  it('holds while nothing has happened to the model the studio opens on', () => {
    expect(showingPlaceholder(opening)).toBe(true);
  });

  it('is over at the first edit, and stays over once that edit is undone', () => {
    const drawn = reduce(opening, added);

    expect(showingPlaceholder(drawn)).toBe(false);
    expect(showingPlaceholder(reduce(drawn, Action.Undo()))).toBe(false);
  });

  it('is over once the model lives in a file, opened or saved into one', () => {
    expect(showingPlaceholder(reduce(opening, opened))).toBe(false);
    expect(showingPlaceholder(reduce(opening, saved))).toBe(false);
  });

  it('was never showing for a model that arrived any other way', () => {
    expect(showingPlaceholder(start)).toBe(false);
  });

  it('comes back once the model is closed back to the one the studio opens on', () => {
    const closed = reduce(
      reduce(reduce(opening, added), saved),
      Action.Closed(),
    );

    expect(showingPlaceholder(closed)).toBe(true);
  });
});

describe('windowTitle', () => {
  it('gives a model with no file a non-empty title', () => {
    expect(windowTitle(initialState(placeholderModel)).trim()).not.toBe('');
  });

  it('says the file once the model lives in one, opened or saved', () => {
    const opened = reduce(
      start,
      Action.Opened({
        model: sampleModel,
        name: 'other.yaml',
        source: nativeSource,
        divergences: [],
      }),
    );
    const saved = reduce(
      start,
      Action.Saved({ name: 'model.yaml', source: nativeSource }),
    );

    expect(windowTitle(opened)).toContain('other.yaml');
    expect(windowTitle(saved)).toContain('model.yaml');
    expect(windowTitle(opened)).not.toBe(windowTitle(saved));
  });
});
