import { DetectionFailure, ReadFailure } from '@saerskriven/formats';
import { emptyModel } from '@saerskriven/model';
import { diagramId, elementId, threatId } from '@saerskriven/model/fixtures';
import { Action } from './actions.js';
import { reduce } from './reducer.js';
import {
  FileLifecycle,
  StudioFailure,
  initialState,
  placeholderModel,
  type State,
} from './state.js';
import {
  actorElement,
  firstThreat,
  foreignSource,
  mainDiagram,
  nativeSource,
  newProcess,
  processElement,
  sampleModel,
  sampleThreat,
} from './store.fixtures.js';

const start = initialState(sampleModel);

type StudioActionTag =
  | 'Undo'
  | 'Redo'
  | 'Select'
  | 'Renaming'
  | 'Opened'
  | 'Saved'
  | 'Closed'
  | 'ReadFailed'
  | 'FileRefused';

type ModelActionTag = Exclude<Action['_tag'], StudioActionTag>;

type ActionsByTag<Tag extends Action['_tag']> = {
  readonly [T in Tag]: Extract<Action, { readonly _tag: T }>;
};

const applied: ActionsByTag<ModelActionTag> = {
  AddElement: Action.AddElement({
    diagramId: mainDiagram,
    element: newProcess('process-added', 'Added'),
  }),
  RemoveElement: Action.RemoveElement({ elementId: processElement }),
  RemoveElements: Action.RemoveElements({
    elementIds: [actorElement, processElement],
  }),
  MoveElement: Action.MoveElement({
    elementId: processElement,
    offset: { x: 10, y: -5 },
  }),
  MoveElements: Action.MoveElements({
    elementIds: [actorElement, processElement],
    offset: { x: 10, y: -5 },
  }),
  ResizeElement: Action.ResizeElement({
    elementId: processElement,
    size: { width: 200, height: 90 },
  }),
  RenameElement: Action.RenameElement({
    elementId: processElement,
    name: 'Renamed',
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

const refused: ActionsByTag<ModelActionTag> = {
  AddElement: Action.AddElement({
    diagramId: diagramId('diagram-missing'),
    element: newProcess('process-refused', 'Refused'),
  }),
  RemoveElement: Action.RemoveElement({
    elementId: elementId('element-missing'),
  }),
  RemoveElements: Action.RemoveElements({
    elementIds: [processElement, elementId('element-missing')],
  }),
  MoveElement: Action.MoveElement({
    elementId: elementId('element-missing'),
    offset: { x: 1, y: 1 },
  }),
  MoveElements: Action.MoveElements({
    elementIds: [processElement, elementId('element-missing')],
    offset: { x: 1, y: 1 },
  }),
  ResizeElement: Action.ResizeElement({
    elementId: elementId('element-missing'),
    size: { width: 10, height: 10 },
  }),
  RenameElement: Action.RenameElement({
    elementId: processElement,
    name: '',
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

const withHistory: State = {
  ...start,
  past: [emptyModel],
  future: [emptyModel],
  file: FileLifecycle.Opened({ name: 'model.json', source: foreignSource }),
};

const studioActions: ActionsByTag<StudioActionTag> = {
  Undo: Action.Undo(),
  Redo: Action.Redo(),
  Select: Action.Select({ elementIds: [actorElement] }),
  Renaming: Action.Renaming({ elementId: actorElement }),
  Opened: Action.Opened({
    model: emptyModel,
    name: 'model.json',
    source: foreignSource,
    divergences: [],
  }),
  Saved: Action.Saved({ name: 'model.yaml', source: nativeSource }),
  Closed: Action.Closed(),
  ReadFailed: Action.ReadFailed({
    name: 'model.yaml',
    failure: ReadFailure.MalformedText({ message: 'not YAML' }),
  }),
  FileRefused: Action.FileRefused({
    operation: 'open',
    reason: 'the browser said no',
  }),
};

const purityCases: readonly (readonly [State, Action])[] = [
  ...Object.values(applied).map((action) => [start, action] as const),
  ...Object.values(refused).map((action) => [start, action] as const),
  ...Object.values(studioActions).map(
    (action) => [withHistory, action] as const,
  ),
];

describe('purity', () => {
  for (const [state, action] of purityCases) {
    it(`leaves the state it was handed untouched while reducing ${action._tag}`, () => {
      const before = structuredClone(state);
      reduce(state, action);
      expect(state).toStrictEqual(before);
    });
  }
});

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
      expect(next.lastFailure?._tag).toBe('Operation');
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
    const selected = reduce(
      start,
      Action.Select({ elementIds: [actorElement] }),
    );
    expect(selected.selection).toEqual([actorElement]);
    expect(
      reduce(selected, Action.Select({ elementIds: [] })).selection,
    ).toEqual([]);
  });

  it('clears when the element it names is removed', () => {
    const selected = reduce(
      start,
      Action.Select({ elementIds: [processElement] }),
    );
    expect(reduce(selected, applied.RemoveElement).selection).toEqual([]);
  });

  it('stays on an element another removal does not touch', () => {
    const selected = reduce(
      start,
      Action.Select({ elementIds: [actorElement] }),
    );
    expect(reduce(selected, applied.RemoveElement).selection).toEqual([
      actorElement,
    ]);
  });

  it('clears every removed member of a multi-selection', () => {
    const selected = reduce(
      start,
      Action.Select({ elementIds: [actorElement, processElement] }),
    );
    expect(reduce(selected, applied.RemoveElements).selection).toEqual([]);
  });
});

describe('the name a field is open on', () => {
  const opened = reduce(start, Action.Renaming({ elementId: processElement }));

  it('follows what the canvas opens and closes', () => {
    expect(opened.renaming).toBe(processElement);
    expect(
      reduce(opened, Action.Renaming({ elementId: undefined })).renaming,
    ).toBeUndefined();
  });

  it('stays out of the undo stacks, an edit being the only thing they hold', () => {
    expect(opened.past).toEqual([]);
    expect(opened.present).toBe(start.present);
    const edited = reduce(opened, applied.RenameElement);
    expect(reduce(edited, Action.Undo()).renaming).toBe(processElement);
  });

  it('closes when the element it names is removed', () => {
    expect(reduce(opened, applied.RemoveElement).renaming).toBeUndefined();
  });
});

describe('the file lifecycle', () => {
  it('opens on a fresh history, with the opened model already saved', () => {
    const working = reduce(start, applied.AddElement);
    const opened = reduce(working, studioActions.Opened);
    expect(opened.present).toBe(emptyModel);
    expect(opened.saved).toBe(emptyModel);
    expect(opened.past).toEqual([]);
    expect(opened.future).toEqual([]);
    expect(opened.file).toEqual(
      FileLifecycle.Opened({ name: 'model.json', source: foreignSource }),
    );
  });

  it('keeps nothing of what the read dropped, which describes the file', () => {
    const opened = reduce(
      start,
      Action.Opened({
        model: emptyModel,
        name: 'model.json',
        source: foreignSource,
        divergences: [
          {
            subject: { kind: 'model' },
            detail: 'the key unknownRoot',
            reason: 'undeclared',
          },
        ],
      }),
    );

    expect(JSON.stringify(opened)).not.toContain('unknownRoot');
  });

  it('names the file a first save writes to, having had none', () => {
    const working = reduce(start, applied.AddElement);
    const saved = reduce(
      working,
      Action.Saved({ name: 'new.yaml', source: nativeSource }),
    );
    expect(saved.saved).toBe(working.present);
    expect(saved.past).toBe(working.past);
    expect(saved.file).toEqual(
      FileLifecycle.Opened({ name: 'new.yaml', source: nativeSource }),
    );
  });

  it('moves the open file, and what a save merges onto, when a save writes elsewhere', () => {
    const opened = reduce(
      start,
      Action.Opened({
        model: sampleModel,
        name: 'model.json',
        source: foreignSource,
        divergences: [],
      }),
    );
    const working = reduce(opened, applied.AddElement);
    const saved = reduce(
      working,
      Action.Saved({ name: 'model.yaml', source: nativeSource }),
    );
    expect(saved.saved).toBe(working.present);
    expect(saved.file).toEqual(
      FileLifecycle.Opened({ name: 'model.yaml', source: nativeSource }),
    );
  });

  it('keeps the retained document out of the undo stacks', () => {
    const opened = reduce(start, studioActions.Opened);
    const working = reduce(opened, applied.AddElement);
    expect(reduce(working, Action.Undo()).file).toBe(opened.file);
  });

  it('closes back to the state the studio booted in, keeping nothing of the file', () => {
    const working = reduce(
      withHistory,
      Action.Select({ elementIds: [actorElement] }),
    );
    expect(working.past).toHaveLength(1);
    expect(working.future).toHaveLength(1);

    const closed = reduce(working, Action.Closed());

    expect(closed.file).toEqual(FileLifecycle.NoFile());
    expect(closed.present).toBe(placeholderModel);
    expect(closed.saved).toBe(placeholderModel);
    expect(closed.past).toEqual([]);
    expect(closed.future).toEqual([]);
    expect(closed.selection).toEqual([]);
  });
});

describe('a refusal outside the model', () => {
  it.each(['open', 'save'] as const)(
    'records a %s refusal with its file policy',
    (operation) => {
      const opened = reduce(start, studioActions.Opened);
      const next = reduce(
        opened,
        Action.FileRefused({ operation, reason: 'NotAllowedError' }),
      );
      expect(next.file).toEqual(
        operation === 'open' ? FileLifecycle.NoFile() : opened.file,
      );
      expect(next.present).toBe(opened.present);
      expect(next.saved).toBe(opened.saved);
    },
  );

  it('records why nothing read the file, leaving the model alone', () => {
    const next = reduce(start, studioActions.ReadFailed);
    expect(next.present).toBe(start.present);
    expect(next.past).toEqual([]);
    expect(next.lastFailure).toEqual(
      StudioFailure.Read({
        name: 'model.yaml',
        failure: ReadFailure.MalformedText({ message: 'not YAML' }),
      }),
    );
  });

  it('records a detection failure as the read failure it is', () => {
    const failure = DetectionFailure.NoFormatClaimed({
      tried: ['threat-dragon', 'saerskriven-yaml'],
    });
    const next = reduce(
      start,
      Action.ReadFailed({ name: 'notes.txt', failure }),
    );
    expect(next.lastFailure).toEqual(
      StudioFailure.Read({ name: 'notes.txt', failure }),
    );
  });

  it('records what the platform said when no file arrived at all', () => {
    const next = reduce(start, studioActions.FileRefused);
    expect(next.lastFailure).toEqual(
      StudioFailure.File({ reason: 'the browser said no' }),
    );
  });

  it('clears a stale refusal once a save lands', () => {
    const stuck = reduce(start, studioActions.FileRefused);
    expect(reduce(stuck, studioActions.Saved).lastFailure).toBeUndefined();
  });
});
