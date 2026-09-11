import { DetectionFailure, ReadFailure } from '@saerskriven/formats';
import {
  emptyModel,
  OperationFailure,
  type DiagramId,
} from '@saerskriven/model';
import { diagramId, elementId, threatId } from '@saerskriven/model/fixtures';
import { Action } from './actions.js';
import { reduce } from './reducer.js';
import { activeDiagramId } from './selectors.js';
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
  newNote,
  newProcess,
  otherElement,
  processElement,
  sampleModel,
  sampleThreat,
  secondDiagram,
  twoDiagramModel,
} from './store.fixtures.js';

const start = initialState(sampleModel);
const noteElement = elementId('note-editable');
const noteModel = {
  ...sampleModel,
  diagrams: sampleModel.diagrams.map((diagram) => ({
    ...diagram,
    elements: [...diagram.elements, newNote(noteElement, 'Draft note')],
  })),
};
const noteStart = initialState(noteModel);

type StudioActionTag =
  | 'Undo'
  | 'Redo'
  | 'SelectDiagram'
  | 'Select'
  | 'InlineEditing'
  | 'Imported'
  | 'ImportFailed'
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
  AddDiagram: Action.AddDiagram({
    diagram: { id: secondDiagram, title: 'Second', elements: [] },
  }),
  RenameDiagram: Action.RenameDiagram({
    diagramId: mainDiagram,
    title: 'Retitled',
  }),
  InsertFragment: Action.InsertFragment({
    diagramId: mainDiagram,
    fragment: placeholderModel,
  }),
  ArrangeElements: Action.ArrangeElements({
    moves: [{ elementId: processElement, offset: { x: 10, y: 20 } }],
  }),
  ReconnectFlow: Action.ReconnectFlow({
    elementId: elementId('placeholder-flow'),
    side: 'source',
    endpointId: elementId('extra-actor'),
  }),
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
    offset: { x: -10, y: -5 },
    size: { width: 200, height: 90 },
  }),
  RenameElement: Action.RenameElement({
    elementId: processElement,
    name: 'Renamed',
  }),
  EditNote: Action.EditNote({
    elementId: noteElement,
    text: 'Edited note',
  }),
  SetFlowWaypoints: Action.SetFlowWaypoints({
    elementId: elementId('placeholder-flow'),
    waypoints: [{ x: 200, y: 100 }],
  }),
  SetFlowDirection: Action.SetFlowDirection({
    elementId: elementId('placeholder-flow'),
    bidirectional: true,
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
  AddDiagram: Action.AddDiagram({
    diagram: { id: mainDiagram, title: 'Again', elements: [] },
  }),
  RenameDiagram: Action.RenameDiagram({
    diagramId: diagramId('diagram-missing'),
    title: 'Retitled',
  }),
  InsertFragment: Action.InsertFragment({
    diagramId: mainDiagram,
    fragment: sampleModel,
  }),
  ArrangeElements: Action.ArrangeElements({
    moves: [
      { elementId: processElement, offset: { x: 10, y: 20 } },
      { elementId: elementId('missing'), offset: { x: 10, y: 20 } },
    ],
  }),
  ReconnectFlow: Action.ReconnectFlow({
    elementId: processElement,
    side: 'source',
    endpointId: actorElement,
  }),
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
    offset: { x: 0, y: 0 },
    size: { width: 10, height: 10 },
  }),
  RenameElement: Action.RenameElement({
    elementId: processElement,
    name: '',
  }),
  EditNote: Action.EditNote({
    elementId: processElement,
    text: 'Not a note',
  }),
  SetFlowWaypoints: Action.SetFlowWaypoints({
    elementId: processElement,
    waypoints: [],
  }),
  SetFlowDirection: Action.SetFlowDirection({
    elementId: processElement,
    bidirectional: true,
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
  SelectDiagram: Action.SelectDiagram({ diagramId: mainDiagram }),
  Select: Action.Select({ elementIds: [actorElement] }),
  InlineEditing: Action.InlineEditing({
    editor: { kind: 'name', elementId: actorElement },
  }),
  Opened: Action.Opened({
    model: emptyModel,
    name: 'model.json',
    source: foreignSource,
    divergences: [],
  }),
  Imported: Action.Imported({
    model: emptyModel,
    name: 'imported.yaml',
    divergences: [],
  }),
  ImportFailed: Action.ImportFailed({
    name: 'model.otm',
    failure: ReadFailure.MalformedText({ message: 'not YAML' }),
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
  ...Object.values(applied).map(
    (action) => [stateFor(action), action] as const,
  ),
  ...Object.values(refused).map((action) => [start, action] as const),
  ...Object.values(studioActions).map(
    (action) => [withHistory, action] as const,
  ),
];

function stateFor(action: Action): State {
  if (Action.$is('ReconnectFlow')(action)) {
    return initialState(
      reduce(
        initialState(placeholderModel),
        Action.AddElement({
          diagramId: placeholderModel.diagrams[0].id,
          element: newProcess('extra-actor', 'Extra actor'),
        }),
      ).present,
    );
  }
  if (
    Action.$is('SetFlowWaypoints')(action) ||
    Action.$is('SetFlowDirection')(action)
  ) {
    return initialState(placeholderModel);
  }
  return Action.$is('EditNote')(action) ? noteStart : start;
}

it('keeps history and saved identity for an unchanged route', () => {
  const before = stateFor(applied.SetFlowWaypoints);
  const next = reduce(
    before,
    Action.SetFlowWaypoints({ ...applied.SetFlowWaypoints, waypoints: [] }),
  );
  expect(next).toBe(before);
});

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
      const before = stateFor(action);
      const next = reduce(before, action);
      expect(next.present).not.toBe(before.present);
      expect(next.past).toHaveLength(1);
      expect(next.past.at(0)).toBe(before.present);
      expect(next.future).toEqual([]);
      expect(next.lastFailure).toBeUndefined();
    });

    it(`round-trips ${action._tag} through undo and redo`, () => {
      const before = stateFor(action);
      const edited = reduce(before, action);
      const undone = reduce(edited, Action.Undo());
      expect(undone.present).toBe(before.present);
      expect(undone.past).toEqual([]);
      const redone = reduce(undone, Action.Redo());
      expect(redone.present).toBe(edited.present);
      expect(reduce(redone, Action.Undo()).present).toBe(before.present);
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

const show = (chosen: DiagramId): Action =>
  Action.SelectDiagram({ diagramId: chosen });

describe('the active diagram', () => {
  const twoStart = initialState(twoDiagramModel);

  it('starts unnamed, so the first diagram is on screen', () => {
    expect(twoStart.activeDiagram).toBeUndefined();
    expect(activeDiagramId(twoStart)).toBe(mainDiagram);
  });

  it('moves to the diagram chosen, with no history and no unsaved work', () => {
    const switched = reduce(twoStart, show(secondDiagram));
    expect(activeDiagramId(switched)).toBe(secondDiagram);
    expect(switched.present).toBe(twoStart.present);
    expect(switched.saved).toBe(twoStart.saved);
    expect(switched.past).toEqual([]);
    expect(switched.future).toEqual([]);
    expect(reduce(switched, Action.Undo())).toBe(switched);
  });

  it('is the same state when the diagram chosen is the one on screen', () => {
    expect(reduce(twoStart, show(mainDiagram))).toBe(twoStart);
    const switched = reduce(twoStart, show(secondDiagram));
    expect(reduce(switched, show(secondDiagram))).toBe(switched);
  });

  it('clears the selection and closes the inline editor, which belong to the diagram left', () => {
    const editing = reduce(
      reduce(twoStart, Action.Select({ elementIds: [actorElement] })),
      Action.InlineEditing({
        editor: { kind: 'name', elementId: actorElement },
      }),
    );
    const switched = reduce(editing, show(secondDiagram));
    expect(switched.selection).toEqual([]);
    expect(switched.inlineEditor).toBeUndefined();
  });

  it('refuses a diagram the model does not hold and stays where it is', () => {
    const unknown = reduce(twoStart, show(diagramId('diagram-missing')));
    expect(activeDiagramId(unknown)).toBe(mainDiagram);
    expect(unknown.lastFailure).toEqual(
      StudioFailure.Operation({
        failure: OperationFailure.UnknownDiagram({
          diagramId: diagramId('diagram-missing'),
        }),
      }),
    );
  });

  it('stays through an edit and its undo, an edit being the only thing the stacks hold', () => {
    const switched = reduce(twoStart, show(secondDiagram));
    const edited = reduce(
      switched,
      Action.RenameElement({ elementId: otherElement, name: 'Renamed' }),
    );
    expect(activeDiagramId(edited)).toBe(secondDiagram);
    expect(activeDiagramId(reduce(edited, Action.Undo()))).toBe(secondDiagram);
  });

  it('falls back to the first diagram while the model no longer holds the one named', () => {
    const switched = reduce(twoStart, show(secondDiagram));
    const opened = reduce(
      switched,
      Action.Opened({
        model: sampleModel,
        name: 'one.yaml',
        source: nativeSource,
        divergences: [],
      }),
    );
    expect(opened.activeDiagram).toBeUndefined();
    expect(activeDiagramId(opened)).toBe(mainDiagram);
    expect(activeDiagramId({ ...switched, present: sampleModel })).toBe(
      mainDiagram,
    );
  });

  it('shows the diagram it adds, and shows the first again once the add is undone', () => {
    const selected = reduce(
      start,
      Action.Select({ elementIds: [actorElement] }),
    );
    const added = reduce(selected, applied.AddDiagram);
    expect(activeDiagramId(added)).toBe(secondDiagram);
    expect(added.selection).toEqual([]);
    expect(added.past).toHaveLength(1);
    expect(activeDiagramId(reduce(added, Action.Undo()))).toBe(mainDiagram);
    expect(reduce(start, refused.AddDiagram)).toMatchObject({
      present: start.present,
      activeDiagram: undefined,
    });
  });

  it('resets on a new model and on closing, with the rest of the view state', () => {
    const switched = reduce(twoStart, show(secondDiagram));
    expect(
      reduce(switched, studioActions.Imported).activeDiagram,
    ).toBeUndefined();
    expect(reduce(switched, Action.Closed()).activeDiagram).toBeUndefined();
  });
});

describe('the inline editor', () => {
  const editor = { kind: 'name', elementId: processElement } as const;
  const opened = reduce(start, Action.InlineEditing({ editor }));

  it('follows what the canvas opens and closes', () => {
    expect(opened.inlineEditor).toEqual(editor);
    expect(
      reduce(opened, Action.InlineEditing({ editor: undefined })).inlineEditor,
    ).toBeUndefined();
  });

  it('stays out of the undo stacks, an edit being the only thing they hold', () => {
    expect(opened.past).toEqual([]);
    expect(opened.present).toBe(start.present);
    const edited = reduce(opened, applied.RenameElement);
    expect(reduce(edited, Action.Undo()).inlineEditor).toEqual(editor);
  });

  it('closes when the element it names is removed', () => {
    expect(reduce(opened, applied.RemoveElement).inlineEditor).toBeUndefined();
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
