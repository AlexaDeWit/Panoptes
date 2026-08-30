import { Either } from 'effect';
import { elementSchema, type Element, type Flow } from './elements.js';
import { validModelFixture } from './fixtures.js';
import { diagramIdSchema, elementIdSchema } from './ids.js';
import {
  addElement,
  moveElement,
  removeElement,
  resizeElement,
  type OperationFailure,
} from './operations.js';
import { parseModel, type Model } from './parse.js';

const parsedFixture = parseModel(validModelFixture);
if (Either.isLeft(parsedFixture)) {
  throw new Error('The operations specs need the valid fixture to parse.');
}
const base: Model = parsedFixture.right;

const elementId = (value: string) => elementIdSchema.parse(value);
const diagramId = (value: string) => diagramIdSchema.parse(value);
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
};

const cache = elementSchema.parse(storeInput);
const writeFlow = elementSchema.parse(flowInput);

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
    const annexed = parseModel(draft);
    if (Either.isLeft(annexed)) {
      throw new Error('The two-diagram fixture must parse.');
    }
    const next = modelOf(addElement(annexed.right, mainDiagram, cache));
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
    ).toEqual({ _tag: 'UnknownDiagram', diagramId: 'diagram-ghost' });
  });

  it('fails on a duplicate element id', () => {
    const clash = elementSchema.parse({ ...storeInput, id: 'element-api' });
    expect(errorOf(addElement(base, mainDiagram, clash))).toEqual({
      _tag: 'DuplicateElementId',
      elementId: 'element-api',
    });
  });

  it('fails on a flow endpoint anchored outside the diagram', () => {
    const dangling = elementSchema.parse({
      ...flowInput,
      id: 'element-dangling-flow',
      target: { kind: 'attached', element: 'element-ghost' },
    });
    expect(errorOf(addElement(base, mainDiagram, dangling))).toEqual({
      _tag: 'InvalidFlowEndpoint',
      side: 'target',
      reference: 'element-ghost',
    });
  });

  it('fails on a flow anchored to itself', () => {
    const selfAnchored = elementSchema.parse({
      ...flowInput,
      id: 'element-loop-flow',
      source: { kind: 'attached', element: 'element-loop-flow' },
    });
    expect(errorOf(addElement(base, mainDiagram, selfAnchored))).toEqual({
      _tag: 'InvalidFlowEndpoint',
      side: 'source',
      reference: 'element-loop-flow',
    });
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

  it('detaches the removed element from threat and assumption links', () => {
    const next = modelOf(removeElement(base, elementId('element-api')));
    expect(next.threats).toHaveLength(1);
    expect(next.threats[0].elements).toEqual(['element-order-flow']);
    const other = modelOf(removeElement(base, elementId('element-db')));
    expect(other.assumptions[0].elements).toEqual([]);
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
    expect(errorOf(removeElement(base, elementId('element-ghost')))).toEqual({
      _tag: 'UnknownElement',
      elementId: 'element-ghost',
    });
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
    ).toEqual({ _tag: 'UnknownElement', elementId: 'element-ghost' });
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
    ).toEqual({ _tag: 'NotResizable', elementId: 'element-order-flow' });
    expect(
      errorOf(resizeElement(base, elementId('element-billing-zone'), size)),
    ).toEqual({ _tag: 'NotResizable', elementId: 'element-billing-zone' });
  });

  it('fails on an unknown element', () => {
    expect(
      errorOf(
        resizeElement(base, elementId('element-ghost'), {
          width: 10,
          height: 10,
        }),
      ),
    ).toEqual({ _tag: 'UnknownElement', elementId: 'element-ghost' });
  });
});

describe('operation purity', () => {
  it('leaves the input model untouched', () => {
    const pristine = structuredClone(base);
    addElement(base, mainDiagram, cache);
    removeElement(base, elementId('element-customer'));
    moveElement(base, elementId('element-api'), { x: 1, y: 1 });
    resizeElement(base, elementId('element-api'), { width: 5, height: 5 });
    expect(base).toEqual(pristine);
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
  ];

  for (const [operation, result] of outputs) {
    it(`${operation} returns a model parseModel accepts`, () => {
      expect(Either.isRight(parseModel(modelOf(result)))).toBe(true);
    });
  }
});
