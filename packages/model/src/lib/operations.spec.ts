import { Either } from 'effect';
import { diagramId, elementId, parsedFixture } from '../fixtures.js';
import { elementSchema, type Element, type Flow } from './elements.js';
import { validModelFixture } from './fixtures.js';
import { OperationFailure } from './operation-failures.js';
import {
  addDiagram,
  addElement,
  editNote,
  renameDiagram,
  moveElement,
  removeDiagram,
  removeElement,
  renameElement,
  resizeElement,
  setFlowDirection,
  setFlowWaypoints,
  reconnectFlow,
} from './operations.js';
import { parseModel, type Model } from './parse.js';

const base = parsedFixture(validModelFixture);
const mainDiagram = diagramId('diagram-main');

type OperationOutcome = Either.Either<Model, OperationFailure>;

const modelOf = (result: OperationOutcome): Model => {
  if (Either.isLeft(result)) {
    throw new Error(`Expected the operation to succeed: ${result.left._tag}`);
  }
  return result.right;
};

const errorOf = (result: OperationOutcome): OperationFailure | undefined =>
  Either.isLeft(result) ? result.left : undefined;

const elementIds = (model: Model): string[] =>
  model.diagrams.flatMap((diagram) =>
    diagram.elements.map((element) => element.id),
  );

const elementIn = (model: Model, id: string): Element => {
  const element = model.diagrams
    .flatMap((diagram) => diagram.elements)
    .find((candidate) => candidate.id === id);
  if (!element) {
    throw new Error(`Element ${id} is missing from the model.`);
  }
  return element;
};

const flowIn = (model: Model, id: string): Flow => {
  const element = elementIn(model, id);
  if (element.kind !== 'flow') {
    throw new Error(`Element ${id} is not a flow.`);
  }
  return element;
};

const storeInput = {
  kind: 'store',
  id: 'element-cache',
  name: 'Session cache',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x: 600, y: 320 },
  size: { width: 160, height: 80 },
};

const flowInput = {
  kind: 'flow',
  id: 'element-write-flow',
  name: 'Write order',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  source: { kind: 'attached', element: 'element-api' },
  target: { kind: 'attached', element: 'element-db' },
  waypoints: [],
  bidirectional: false,
};

const noteInput = {
  kind: 'text',
  id: 'element-note',
  name: 'Note',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  text: 'Draft note',
  position: { x: 600, y: 440 },
  size: { width: 200, height: 80 },
};

const cache = elementSchema.parse(storeInput);
const writeFlow = elementSchema.parse(flowInput);
const note = elementSchema.parse(noteInput);
const withNote = modelOf(addElement(base, mainDiagram, note));

describe('setFlowWaypoints', () => {
  const before = modelOf(addElement(base, mainDiagram, writeFlow));
  it('preserves the flow metadata and model while changing ordered route points', () => {
    const snapshot = structuredClone(before);
    const waypoints = [
      { x: -10.5, y: 30 },
      { x: 400, y: 100 },
    ];
    const next = modelOf(setFlowWaypoints(before, writeFlow.id, waypoints));
    expect(flowIn(next, writeFlow.id)).toEqual({ ...writeFlow, waypoints });
    expect(before).toEqual(snapshot);
    expect(next.threats).toBe(before.threats);
    waypoints[0].x = 999;
    expect(flowIn(next, writeFlow.id).waypoints[0].x).toBe(-10.5);
    expect(
      modelOf(
        setFlowWaypoints(
          next,
          writeFlow.id,
          flowIn(next, writeFlow.id).waypoints,
        ),
      ),
    ).toBe(next);
    expect(
      flowIn(modelOf(setFlowWaypoints(next, writeFlow.id, [])), writeFlow.id)
        .waypoints,
    ).toEqual([]);
  });
  it('refuses missing elements and other element kinds', () => {
    expect(errorOf(setFlowWaypoints(before, elementId('missing'), []))).toEqual(
      OperationFailure.UnknownElement({ elementId: elementId('missing') }),
    );
    expect(errorOf(setFlowWaypoints(withNote, note.id, []))).toEqual(
      OperationFailure.NotFlowElement({ elementId: note.id }),
    );
  });
});

describe('addElement', () => {
  it('adds a node to the named diagram', () => {
    const next = modelOf(addElement(base, mainDiagram, cache));
    expect(elementIds(next)).toContain('element-cache');
  });

  it('adds a flow anchored to elements of the target diagram', () => {
    const next = modelOf(addElement(base, mainDiagram, writeFlow));
    expect(flowIn(next, 'element-write-flow').source).toEqual({
      kind: 'attached',
      element: 'element-api',
    });
  });

  it('leaves diagrams other than the target untouched', () => {
    const draft = structuredClone(validModelFixture);
    draft.diagrams.push({ id: 'diagram-annex', title: 'Annex', elements: [] });
    const next = modelOf(addElement(parsedFixture(draft), mainDiagram, cache));
    expect(next.diagrams[1]).toEqual({
      id: 'diagram-annex',
      title: 'Annex',
      elements: [],
    });
    expect(elementIds(next)).toContain('element-cache');
  });

  it('adds a trust boundary', () => {
    const zone = elementSchema.parse({
      kind: 'trust-boundary',
      id: 'element-dmz',
      name: 'DMZ',
      description: '',
      outOfScope: false,
      reasonOutOfScope: '',
      shape: {
        kind: 'box',
        position: { x: 20, y: 400 },
        size: { width: 300, height: 140 },
      },
    });
    const next = modelOf(addElement(base, mainDiagram, zone));
    expect(elementIn(next, 'element-dmz').kind).toBe('trust-boundary');
  });

  it('fails on an unknown diagram', () => {
    expect(
      errorOf(addElement(base, diagramId('diagram-ghost'), cache)),
    ).toEqual(
      OperationFailure.UnknownDiagram({
        diagramId: diagramId('diagram-ghost'),
      }),
    );
  });

  it('fails on a duplicate element id', () => {
    const clash = elementSchema.parse({ ...storeInput, id: 'element-api' });
    expect(errorOf(addElement(base, mainDiagram, clash))).toEqual(
      OperationFailure.DuplicateElementId({
        elementId: elementId('element-api'),
      }),
    );
  });

  it('fails on a flow endpoint anchored outside the diagram', () => {
    const dangling = elementSchema.parse({
      ...flowInput,
      id: 'element-dangling-flow',
      target: { kind: 'attached', element: 'element-ghost' },
    });
    expect(errorOf(addElement(base, mainDiagram, dangling))).toEqual(
      OperationFailure.InvalidFlowEndpoint({
        side: 'target',
        reference: elementId('element-ghost'),
      }),
    );
  });

  it('fails on a flow anchored to itself', () => {
    const selfAnchored = elementSchema.parse({
      ...flowInput,
      id: 'element-loop-flow',
      source: { kind: 'attached', element: 'element-loop-flow' },
    });
    expect(errorOf(addElement(base, mainDiagram, selfAnchored))).toEqual(
      OperationFailure.InvalidFlowEndpoint({
        side: 'source',
        reference: elementId('element-loop-flow'),
      }),
    );
  });
});

describe('removeElement', () => {
  it('removes the element from its diagram', () => {
    const next = modelOf(removeElement(base, elementId('element-db')));
    expect(elementIds(next)).not.toContain('element-db');
  });

  it('frees the endpoints of flows anchored to the removed element', () => {
    const next = modelOf(removeElement(base, elementId('element-customer')));
    expect(flowIn(next, 'element-order-flow').source).toEqual({
      kind: 'free',
      position: { x: 120, y: 160 },
    });
    expect(Either.isRight(parseModel(next))).toBe(true);
  });

  it('detaches the removed element from threat links', () => {
    const next = modelOf(removeElement(base, elementId('element-api')));
    expect(next.threats).toHaveLength(1);
    expect(next.threats[0].elements).toEqual(['element-order-flow']);
  });

  it('leaves every assumption record unchanged', () => {
    const next = modelOf(removeElement(base, elementId('element-db')));
    expect(next.assumptions).toEqual(base.assumptions);
  });

  it('removes a flow and detaches its threat links', () => {
    const next = modelOf(removeElement(base, elementId('element-order-flow')));
    expect(elementIds(next)).not.toContain('element-order-flow');
    expect(next.threats[0].elements).toEqual(['element-api']);
  });

  it('removes a trust boundary of either shape', () => {
    const box = modelOf(removeElement(base, elementId('element-perimeter')));
    expect(elementIds(box)).not.toContain('element-perimeter');
    const curve = modelOf(
      removeElement(base, elementId('element-billing-zone')),
    );
    expect(elementIds(curve)).not.toContain('element-billing-zone');
  });

  it("frees an endpoint at the removed flow's own free endpoint", () => {
    const spur = elementSchema.parse({
      ...flowInput,
      id: 'element-spur-flow',
      source: { kind: 'free', position: { x: 500, y: 500 } },
      target: { kind: 'attached', element: 'element-db' },
    });
    const tap = elementSchema.parse({
      ...flowInput,
      id: 'element-tap-flow',
      source: { kind: 'attached', element: 'element-spur-flow' },
      target: { kind: 'free', position: { x: 640, y: 480 } },
    });
    const seeded = [spur, tap].reduce(
      (model, flow) => modelOf(addElement(model, mainDiagram, flow)),
      base,
    );
    const next = modelOf(removeElement(seeded, elementId('element-spur-flow')));
    expect(flowIn(next, 'element-tap-flow').source).toEqual({
      kind: 'free',
      position: { x: 500, y: 500 },
    });
  });

  it('frees an endpoint at the canvas origin when the removed flow has no point of its own', () => {
    const meter = elementSchema.parse({
      ...flowInput,
      id: 'element-meter-flow',
      source: { kind: 'attached', element: 'element-write-flow' },
      target: { kind: 'free', position: { x: 700, y: 300 } },
    });
    const seeded = [writeFlow, meter].reduce(
      (model, flow) => modelOf(addElement(model, mainDiagram, flow)),
      base,
    );
    const next = modelOf(
      removeElement(seeded, elementId('element-write-flow')),
    );
    expect(flowIn(next, 'element-meter-flow').source).toEqual({
      kind: 'free',
      position: { x: 0, y: 0 },
    });
    expect(Either.isRight(parseModel(next))).toBe(true);
  });

  it('fails on an unknown element', () => {
    expect(errorOf(removeElement(base, elementId('element-ghost')))).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('moveElement', () => {
  it('moves a node by the offset', () => {
    const next = modelOf(
      moveElement(base, elementId('element-customer'), { x: 30, y: -20 }),
    );
    expect(elementIn(next, 'element-customer')).toMatchObject({
      position: { x: 70, y: 100 },
    });
  });

  it('moves the waypoints and free endpoints of a flow, not its anchors', () => {
    const next = modelOf(
      moveElement(base, elementId('element-order-flow'), { x: 10, y: 5 }),
    );
    expect(flowIn(next, 'element-order-flow')).toMatchObject({
      source: { kind: 'attached', element: 'element-customer' },
      target: { kind: 'free', position: { x: 290, y: 165 } },
      waypoints: [{ x: 210, y: 145 }],
    });
  });

  it('moves a trust boundary in either shape', () => {
    const box = modelOf(
      moveElement(base, elementId('element-perimeter'), { x: -10, y: 10 }),
    );
    expect(elementIn(box, 'element-perimeter')).toMatchObject({
      shape: { kind: 'box', position: { x: 270, y: 70 } },
    });
    const curve = modelOf(
      moveElement(base, elementId('element-billing-zone'), { x: 5, y: 5 }),
    );
    expect(elementIn(curve, 'element-billing-zone')).toMatchObject({
      shape: {
        kind: 'curve',
        waypoints: [
          { x: 45, y: 325 },
          { x: 405, y: 305 },
          { x: 765, y: 345 },
        ],
      },
    });
  });

  it('fails on an unknown element', () => {
    expect(
      errorOf(moveElement(base, elementId('element-ghost'), { x: 1, y: 1 })),
    ).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('resizeElement', () => {
  it('resizes a node', () => {
    const next = modelOf(
      resizeElement(base, elementId('element-api'), {
        width: 200,
        height: 100,
      }),
    );
    expect(elementIn(next, 'element-api')).toMatchObject({
      size: { width: 200, height: 100 },
    });
  });

  it('resizes a box trust boundary', () => {
    const next = modelOf(
      resizeElement(base, elementId('element-perimeter'), {
        width: 600,
        height: 240,
      }),
    );
    expect(elementIn(next, 'element-perimeter')).toMatchObject({
      shape: { size: { width: 600, height: 240 } },
    });
  });

  it('refuses a flow and a curve trust boundary', () => {
    const size = { width: 10, height: 10 };
    expect(
      errorOf(resizeElement(base, elementId('element-order-flow'), size)),
    ).toEqual(
      OperationFailure.NotResizable({
        elementId: elementId('element-order-flow'),
      }),
    );
    expect(
      errorOf(resizeElement(base, elementId('element-billing-zone'), size)),
    ).toEqual(
      OperationFailure.NotResizable({
        elementId: elementId('element-billing-zone'),
      }),
    );
  });

  it('fails on an unknown element', () => {
    expect(
      errorOf(
        resizeElement(base, elementId('element-ghost'), {
          width: 10,
          height: 10,
        }),
      ),
    ).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('renameElement', () => {
  it('renames a node', () => {
    const next = modelOf(
      renameElement(base, elementId('element-customer'), 'Buyer'),
    );
    expect(elementIn(next, 'element-customer').name).toBe('Buyer');
  });

  it('renames a flow, which is what the canvas draws as its label', () => {
    const next = modelOf(
      renameElement(base, elementId('element-order-flow'), 'Place order'),
    );
    expect(flowIn(next, 'element-order-flow').name).toBe('Place order');
  });

  it('refuses an empty name', () => {
    expect(errorOf(renameElement(base, elementId('element-api'), ''))).toEqual(
      OperationFailure.EmptyName({ elementId: elementId('element-api') }),
    );
  });

  it('refuses a name of whitespace, which draws as no name at all', () => {
    expect(
      errorOf(renameElement(base, elementId('element-api'), '   ')),
    ).toEqual(
      OperationFailure.EmptyName({ elementId: elementId('element-api') }),
    );
  });

  it('refuses a character the parse boundary refuses, saying where it sits', () => {
    expect(
      errorOf(renameElement(base, elementId('element-api'), 'Order\u00adAPI')),
    ).toEqual(
      OperationFailure.RefusedCharacter({
        elementId: elementId('element-api'),
        at: 5,
      }),
    );
  });

  it('fails on an unknown element', () => {
    expect(
      errorOf(renameElement(base, elementId('element-ghost'), 'Ghost')),
    ).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('editNote', () => {
  it('changes multiline note text, including an empty note', () => {
    const edited = modelOf(
      editNote(withNote, elementId('element-note'), 'First\nSecond'),
    );
    const cleared = modelOf(editNote(edited, elementId('element-note'), ''));
    const element = elementIn(cleared, 'element-note');

    expect(element.kind === 'text' ? element.text : undefined).toBe('');
  });

  it('refuses an element that is not a note', () => {
    expect(
      errorOf(editNote(base, elementId('element-api'), 'Not a note')),
    ).toEqual(
      OperationFailure.NotTextElement({
        elementId: elementId('element-api'),
      }),
    );
  });

  it('refuses a character the parse boundary refuses', () => {
    expect(
      errorOf(
        editNote(withNote, elementId('element-note'), 'Soft\u00adhyphen'),
      ),
    ).toEqual(
      OperationFailure.RefusedCharacter({
        elementId: elementId('element-note'),
        at: 4,
      }),
    );
  });
});

const secondDiagram = diagramId('diagram-second');

const secondOfElements = {
  id: secondDiagram,
  title: 'Second',
  elements: [
    { ...cache, id: elementId('element-second-store') },
    elementSchema.parse({
      ...flowInput,
      id: 'element-second-flow',
      source: { kind: 'attached', element: 'element-second-store' },
      target: { kind: 'free', position: { x: 0, y: 0 } },
    }),
  ],
};

describe('addDiagram', () => {
  it('appends a diagram after the ones the model holds', () => {
    const next = modelOf(
      addDiagram(base, { id: secondDiagram, title: 'Second', elements: [] }),
    );
    expect(next.diagrams.map((diagram) => diagram.id)).toEqual([
      mainDiagram,
      secondDiagram,
    ]);
    expect(next.diagrams[0]).toBe(base.diagrams[0]);
  });

  it('accepts a diagram of elements whose flows stay inside it', () => {
    const next = modelOf(addDiagram(base, secondOfElements));
    expect(next.diagrams[1].elements).toHaveLength(2);
  });

  it('refuses the id of a diagram the model holds', () => {
    expect(
      errorOf(
        addDiagram(base, { id: mainDiagram, title: 'Again', elements: [] }),
      ),
    ).toEqual(OperationFailure.DuplicateDiagramId({ diagramId: mainDiagram }));
  });

  it('refuses an empty title and a refused character in one', () => {
    expect(
      errorOf(
        addDiagram(base, { id: secondDiagram, title: ' ', elements: [] }),
      ),
    ).toEqual(OperationFailure.EmptyTitle({ diagramId: secondDiagram }));
    expect(
      errorOf(
        addDiagram(base, {
          id: secondDiagram,
          title: 'Sec\u00adond',
          elements: [],
        }),
      ),
    ).toEqual(
      OperationFailure.RefusedTitleCharacter({
        diagramId: secondDiagram,
        at: 3,
      }),
    );
  });

  it('refuses an element id the model holds already, or one the diagram repeats', () => {
    expect(
      errorOf(
        addDiagram(base, {
          id: secondDiagram,
          title: 'Second',
          elements: [elementIn(base, 'element-api')],
        }),
      ),
    ).toEqual(
      OperationFailure.DuplicateElementId({
        elementId: elementId('element-api'),
      }),
    );
    expect(
      errorOf(
        addDiagram(base, {
          id: secondDiagram,
          title: 'Second',
          elements: [cache, cache],
        }),
      ),
    ).toEqual(OperationFailure.DuplicateElementId({ elementId: cache.id }));
  });

  it('refuses a flow anchored outside the diagram', () => {
    expect(
      errorOf(
        addDiagram(base, {
          id: secondDiagram,
          title: 'Second',
          elements: [writeFlow],
        }),
      )?._tag,
    ).toBe('InvalidFlowEndpoint');
  });
});

describe('renameDiagram', () => {
  it('retitles the diagram and leaves its elements as they were', () => {
    const next = modelOf(renameDiagram(base, mainDiagram, 'Retitled'));
    expect(next.diagrams[0].title).toBe('Retitled');
    expect(next.diagrams[0].elements).toBe(base.diagrams[0].elements);
  });

  it('refuses an empty title, a whitespace title, and a refused character', () => {
    expect(errorOf(renameDiagram(base, mainDiagram, ''))).toEqual(
      OperationFailure.EmptyTitle({ diagramId: mainDiagram }),
    );
    expect(errorOf(renameDiagram(base, mainDiagram, '  '))).toEqual(
      OperationFailure.EmptyTitle({ diagramId: mainDiagram }),
    );
    expect(errorOf(renameDiagram(base, mainDiagram, 'Ma\u00adin'))).toEqual(
      OperationFailure.RefusedTitleCharacter({ diagramId: mainDiagram, at: 2 }),
    );
  });

  it('fails on an unknown diagram', () => {
    expect(errorOf(renameDiagram(base, secondDiagram, 'Ghost'))).toEqual(
      OperationFailure.UnknownDiagram({ diagramId: secondDiagram }),
    );
  });
});

describe('removeDiagram', () => {
  it('drops a diagram that owns no element', () => {
    const withSecond = modelOf(
      addDiagram(base, { id: secondDiagram, title: 'Second', elements: [] }),
    );
    expect(
      modelOf(removeDiagram(withSecond, secondDiagram)).diagrams.map(
        (diagram) => diagram.id,
      ),
    ).toEqual([mainDiagram]);
  });

  it('refuses a diagram that still owns elements, counting them', () => {
    expect(errorOf(removeDiagram(base, mainDiagram))).toEqual(
      OperationFailure.DiagramNotEmpty({
        diagramId: mainDiagram,
        elements: base.diagrams[0].elements.length,
      }),
    );
  });

  it('fails on an unknown diagram', () => {
    expect(errorOf(removeDiagram(base, secondDiagram))).toEqual(
      OperationFailure.UnknownDiagram({ diagramId: secondDiagram }),
    );
  });

  it('goes through once the caller has emptied it with removeElement', () => {
    const emptied = elementIds(base).reduce(
      (model, id) => modelOf(removeElement(model, elementId(id))),
      base,
    );
    const next = modelOf(removeDiagram(emptied, mainDiagram));
    expect(next.diagrams).toEqual([]);
    expect(next.threats.map((threat) => threat.elements)).toEqual([[]]);
    expect(next.assumptions).toEqual(base.assumptions);
    expect(Either.isRight(parseModel(next))).toBe(true);
  });
});

describe('operation purity', () => {
  it('leaves the input model untouched', () => {
    const pristine = structuredClone(base);
    const notePristine = structuredClone(withNote);
    addElement(base, mainDiagram, cache);
    removeElement(base, elementId('element-customer'));
    moveElement(base, elementId('element-api'), { x: 1, y: 1 });
    resizeElement(base, elementId('element-api'), { width: 5, height: 5 });
    renameElement(base, elementId('element-api'), 'Renamed');
    editNote(withNote, elementId('element-note'), 'Edited');
    addDiagram(base, { id: secondDiagram, title: 'Second', elements: [] });
    renameDiagram(base, mainDiagram, 'Retitled');
    removeDiagram(base, mainDiagram);
    expect(base).toEqual(pristine);
    expect(withNote).toEqual(notePristine);
  });
});

describe('operation outputs re-parse through parseModel', () => {
  const outputs: [string, OperationOutcome][] = [
    ['addElement', addElement(base, mainDiagram, writeFlow)],
    ['removeElement', removeElement(base, elementId('element-customer'))],
    [
      'moveElement',
      moveElement(base, elementId('element-order-flow'), { x: 10, y: 5 }),
    ],
    [
      'resizeElement',
      resizeElement(base, elementId('element-api'), {
        width: 200,
        height: 100,
      }),
    ],
    [
      'renameElement',
      renameElement(base, elementId('element-api'), 'Orders API'),
    ],
    ['editNote', editNote(withNote, elementId('element-note'), 'Edited')],
    [
      'addDiagram',
      addDiagram(base, { id: secondDiagram, title: 'Second', elements: [] }),
    ],
    ['addDiagram of elements', addDiagram(base, secondOfElements)],
    ['renameDiagram', renameDiagram(base, mainDiagram, 'Retitled')],
    [
      'removeDiagram',
      Either.flatMap(
        addDiagram(base, { id: secondDiagram, title: 'Second', elements: [] }),
        (model) => removeDiagram(model, secondDiagram),
      ),
    ],
  ];

  for (const [operation, result] of outputs) {
    it(`${operation} returns a model parseModel accepts`, () => {
      expect(Either.isRight(parseModel(modelOf(result)))).toBe(true);
    });
  }
});

describe('reconnectFlow', () => {
  it('changes one endpoint and retains identity, metadata, bends, and threat links', () => {
    const id = elementId('element-order-flow');
    const before = flowIn(base, id);
    const after = modelOf(
      reconnectFlow(base, id, 'target', elementId('element-db')),
    );
    expect(flowIn(after, id)).toEqual({
      ...before,
      target: { kind: 'attached', element: elementId('element-db') },
    });
    expect(after.threats).toBe(base.threats);
    expect(reconnectFlow(after, id, 'target', elementId('element-db'))).toEqual(
      Either.right(after),
    );
    expect(
      errorOf(reconnectFlow(base, id, 'target', elementId('element-customer')))
        ?._tag,
    ).toBe('InvalidFlowEndpoint');
    expect(
      errorOf(reconnectFlow(base, id, 'target', elementId('missing')))?._tag,
    ).toBe('InvalidFlowEndpoint');
    expect(
      errorOf(
        reconnectFlow(
          base,
          elementId('element-api'),
          'source',
          elementId('element-db'),
        ),
      )?._tag,
    ).toBe('NotFlowElement');
    expect(
      errorOf(
        reconnectFlow(
          base,
          elementId('missing'),
          'source',
          elementId('element-db'),
        ),
      )?._tag,
    ).toBe('UnknownElement');
  });

  it('pins an end to a side of the element it already names, and releases it', () => {
    const id = elementId('element-order-flow');
    const before = flowIn(base, id);
    const element =
      before.source.kind === 'attached' ? before.source.element : undefined;
    if (element === undefined) {
      throw new Error('The fixture flow starts attached');
    }
    const pinned = modelOf(
      reconnectFlow(base, id, 'source', element, 'bottom'),
    );
    expect(flowIn(pinned, id)).toEqual({
      ...before,
      source: { kind: 'attached', element, side: 'bottom' },
    });
    expect(
      modelOf(reconnectFlow(pinned, id, 'source', element, 'bottom')),
    ).toBe(pinned);
    const released = modelOf(reconnectFlow(pinned, id, 'source', element));
    expect(flowIn(released, id).source).toEqual({ kind: 'attached', element });
    expect(
      modelOf(
        reconnectFlow(pinned, id, 'source', elementId('element-db')),
      ).diagrams[0].elements.find((candidate) => candidate.id === id),
    ).toMatchObject({
      source: { kind: 'attached', element: elementId('element-db') },
    });
  });
});

describe('setFlowDirection', () => {
  it('makes a flow bidirectional and one-way again, keeping the model where nothing changes', () => {
    const id = elementId('element-order-flow');
    const before = flowIn(base, id);
    expect(before.bidirectional).toBe(false);
    expect(modelOf(setFlowDirection(base, id, false))).toBe(base);
    const both = modelOf(setFlowDirection(base, id, true));
    expect(flowIn(both, id)).toEqual({ ...before, bidirectional: true });
    expect(flowIn(modelOf(setFlowDirection(both, id, false)), id)).toEqual(
      before,
    );
  });

  it('refuses missing elements and other element kinds', () => {
    expect(
      errorOf(setFlowDirection(base, elementId('element-api'), true))?._tag,
    ).toBe('NotFlowElement');
    expect(
      errorOf(setFlowDirection(base, elementId('missing'), true))?._tag,
    ).toBe('UnknownElement');
  });
});
