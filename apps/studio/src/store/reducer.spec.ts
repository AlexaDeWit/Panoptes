import { Action } from './actions.js';
import {
  actorElement,
  diagramId,
  elementId,
  firstThreat,
  mainDiagram,
  newProcess,
  processElement,
  sampleModel,
  sampleThreat,
  threatId,
} from './fixtures.js';
import { reduce, unmatchedAction } from './reducer.js';
import { FileLifecycle, emptyModel, initialState } from './state.js';

const start = initialState(sampleModel);

type ModelActionTag = Exclude<
  Action['_tag'],
  'Undo' | 'Redo' | 'Select' | 'Opened' | 'Saved'
>;

type ActionsByTag = {
  readonly [Tag in ModelActionTag]: Extract<Action, { readonly _tag: Tag }>;
};

const applied: ActionsByTag = {
  AddElement: Action.AddElement({
    diagramId: mainDiagram,
    element: newProcess('process-added', 'Added'),
  }),
  RemoveElement: Action.RemoveElement({ elementId: processElement }),
  MoveElement: Action.MoveElement({
    elementId: processElement,
    offset: { x: 10, y: -5 },
  }),
  ResizeElement: Action.ResizeElement({
    elementId: processElement,
    size: { width: 200, height: 90 },
  }),
  AddThreat: Action.AddThreat({
    threat: { ...sampleThreat, id: threatId('threat-added'), number: 2 },
  }),
  RemoveThreat: Action.RemoveThreat({ threatId: firstThreat }),
  ReplaceThreat: Action.ReplaceThreat({
    threat: { ...sampleThreat, title: 'Retitled' },
  }),
  AttachThreat: Action.AttachThreat({
    threatId: firstThreat,
    elementId: processElement,
  }),
  DetachThreat: Action.DetachThreat({
    threatId: firstThreat,
    elementId: actorElement,
  }),
};

const refused: ActionsByTag = {
  AddElement: Action.AddElement({
    diagramId: diagramId('diagram-missing'),
    element: newProcess('process-refused', 'Refused'),
  }),
  RemoveElement: Action.RemoveElement({
    elementId: elementId('element-missing'),
  }),
  MoveElement: Action.MoveElement({
    elementId: elementId('element-missing'),
    offset: { x: 1, y: 1 },
  }),
  ResizeElement: Action.ResizeElement({
    elementId: elementId('element-missing'),
    size: { width: 10, height: 10 },
  }),
  AddThreat: Action.AddThreat({
    threat: { ...sampleThreat, id: threatId('threat-reused'), number: 1 },
  }),
  RemoveThreat: Action.RemoveThreat({ threatId: threatId('threat-missing') }),
  ReplaceThreat: Action.ReplaceThreat({
    threat: { ...sampleThreat, id: threatId('threat-missing') },
  }),
  AttachThreat: Action.AttachThreat({
    threatId: threatId('threat-missing'),
    elementId: actorElement,
  }),
  DetachThreat: Action.DetachThreat({
    threatId: threatId('threat-missing'),
    elementId: actorElement,
  }),
};

describe('a model operation', () => {
  for (const action of Object.values(applied)) {
    it(`pushes the model ${action._tag} replaced onto the past`, () => {
      const next = reduce(start, action);
      expect(next.present).not.toBe(start.present);
      expect(next.past).toHaveLength(1);
      expect(next.past.at(0)).toBe(start.present);
      expect(next.future).toEqual([]);
      expect(next.lastFailure).toBeUndefined();
    });

    it(`round-trips ${action._tag} through undo and redo`, () => {
      const edited = reduce(start, action);
      const undone = reduce(edited, Action.Undo());
      expect(undone.present).toBe(start.present);
      expect(undone.past).toEqual([]);
      const redone = reduce(undone, Action.Redo());
      expect(redone.present).toBe(edited.present);
      expect(reduce(redone, Action.Undo()).present).toBe(start.present);
    });
  }
});

describe('an operation the model refuses', () => {
  for (const action of Object.values(refused)) {
    it(`leaves the model and both stacks alone and records why ${action._tag} failed`, () => {
      const next = reduce(start, action);
      expect(next.present).toBe(start.present);
      expect(next.past).toEqual([]);
      expect(next.future).toEqual([]);
      expect(next.lastFailure).toBeDefined();
    });
  }

  it('clears the failure on the next edit that lands', () => {
    const stuck = reduce(start, refused.AddElement);
    expect(reduce(stuck, applied.AddElement).lastFailure).toBeUndefined();
  });
});

describe('history', () => {
  it('is a no-op with nothing to go back to or forward to', () => {
    expect(reduce(start, Action.Undo())).toBe(start);
    expect(reduce(start, Action.Redo())).toBe(start);
  });

  it('drops the future once an edit lands on an undone model', () => {
    const undone = reduce(reduce(start, applied.AddElement), Action.Undo());
    expect(undone.future).toHaveLength(1);
    expect(reduce(undone, applied.MoveElement).future).toEqual([]);
  });
});

describe('selection', () => {
  it('follows what a view selects', () => {
    const selected = reduce(start, Action.Select({ elementId: actorElement }));
    expect(selected.selection).toBe(actorElement);
    expect(
      reduce(selected, Action.Select({ elementId: undefined })).selection,
    ).toBeUndefined();
  });

  it('clears when the element it names is removed', () => {
    const selected = reduce(
      start,
      Action.Select({ elementId: processElement }),
    );
    expect(reduce(selected, applied.RemoveElement).selection).toBeUndefined();
  });

  it('stays on an element another removal does not touch', () => {
    const selected = reduce(start, Action.Select({ elementId: actorElement }));
    expect(reduce(selected, applied.RemoveElement).selection).toBe(
      actorElement,
    );
  });
});

describe('the file lifecycle', () => {
  it('opens on a fresh history, with the opened model already saved', () => {
    const working = reduce(start, applied.AddElement);
    const opened = reduce(
      working,
      Action.Opened({
        model: emptyModel,
        name: 'model.yaml',
        format: 'panoptes-yaml',
      }),
    );
    expect(opened.present).toBe(emptyModel);
    expect(opened.saved).toBe(emptyModel);
    expect(opened.past).toEqual([]);
    expect(opened.future).toEqual([]);
    expect(opened.file).toEqual(
      FileLifecycle.Opened({ name: 'model.yaml', format: 'panoptes-yaml' }),
    );
  });

  it('marks the model on screen as the one the file holds when it is saved', () => {
    const working = reduce(start, applied.AddElement);
    const saved = reduce(working, Action.Saved());
    expect(saved.saved).toBe(working.present);
    expect(saved.past).toBe(working.past);
  });
});

describe('exhaustiveness', () => {
  it('leaves only `never` for a tag with no arm of its own', () => {
    // @ts-expect-error unmatchedAction takes `never`, so an action the switch stops handling fails to compile here
    expect(unmatchedAction(Action.Saved(), start)).toBe(start);
  });
});
