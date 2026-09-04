import { elementIdSchema, type Model } from '@panoptes/model';
import { everyGlyphModel, parsedFixture } from './canvas.fixtures.js';
import { handlePositions } from './handles.js';
import { layoutDiagram, type CanvasEdge, type CanvasNode } from './layout.js';
import { canvasNodeTypes } from './react-flow.js';
import { boundaryStrokeWidth } from './stylesheet.js';

const id = (value: string) => elementIdSchema.parse(value);

const layoutOf = (model: Model) => layoutDiagram(model.diagrams[0], model);

const layout = layoutOf(everyGlyphModel);

const nodeNamed = (value: string): CanvasNode => {
  const found = layout.nodes.find((node) => node.id === id(value));
  if (found === undefined) {
    throw new Error(`No node ${value} in the layout`);
  }
  return found;
};

const edgeNamed = (value: string): CanvasEdge => {
  const found = layout.edges.find((edge) => edge.id === id(value));
  if (found === undefined) {
    throw new Error(`No edge ${value} in the layout`);
  }
  return found;
};

const elementIn = (model: Model, value: string) => {
  const found = model.diagrams[0].elements.find(
    (element) => element.id === id(value),
  );
  if (found === undefined) {
    throw new Error(`No element ${value} in the fixture`);
  }
  return found;
};

const flowBetween = (
  source: unknown,
  target: unknown,
  waypoints: unknown[],
) => ({
  kind: 'flow',
  id: 'el-flow',
  name: 'Flow',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  source,
  target,
  waypoints,
});

const boxAt = (value: string, x: number, y: number) => ({
  kind: 'actor',
  id: value,
  name: value,
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x, y },
  size: { width: 100, height: 100 },
});

const twoBoxDiagram = (flow: unknown, extra: unknown[] = []) =>
  parsedFixture({
    metadata: { title: 't', owner: '', description: '', contributors: [] },
    diagrams: [
      {
        id: 'd',
        title: 'Diagram',
        elements: [
          boxAt('el-left', 0, 0),
          boxAt('el-right', 400, 0),
          flow,
          ...extra,
        ],
      },
    ],
    threats: [],
    lastIssuedThreatNumber: 0,
    mitigations: [],
    assumptions: [],
  });

const attached = (element: string) => ({ kind: 'attached', element });

const curveBoundary = (waypoints: unknown[]): CanvasNode =>
  layoutOf(
    parsedFixture({
      metadata: { title: 't', owner: '', description: '', contributors: [] },
      diagrams: [
        {
          id: 'd',
          title: 'Diagram',
          elements: [
            {
              kind: 'trust-boundary',
              id: 'el-curve',
              name: '',
              description: '',
              outOfScope: false,
              reasonOutOfScope: '',
              shape: { kind: 'curve', waypoints },
            },
          ],
        },
      ],
      threats: [],
      lastIssuedThreatNumber: 0,
      mitigations: [],
      assumptions: [],
    }),
  ).nodes[0];

describe('layoutDiagram', () => {
  it('lays out a node of every kind the canvas draws as a box', () => {
    expect(new Set(layout.nodes.map((node) => node.kind))).toEqual(
      new Set<string>(Object.keys(canvasNodeTypes)),
    );
    expect(layout.edges).toHaveLength(2);
  });

  it('takes a node position and size from the model and nowhere else', () => {
    const element = elementIn(everyGlyphModel, 'el-api');
    const node = nodeNamed('el-api');
    expect(element.kind === 'process' && element.position).toEqual(
      node.position,
    );
    expect(element.kind === 'process' && element.size).toEqual(node.size);
  });

  it('takes a box boundary position and size from its own shape', () => {
    expect(nodeNamed('el-zone').position).toEqual({ x: 0, y: 0 });
    expect(nodeNamed('el-zone').size).toEqual({ width: 640, height: 260 });
  });

  it('sizes a curve boundary to its waypoints grown by the stroke width', () => {
    const node = nodeNamed('el-edge-zone');
    const grown = boundaryStrokeWidth;
    expect(node.position).toEqual({ x: 300 - grown, y: 300 - grown });
    expect(node.size).toEqual({
      width: 240 + grown * 2,
      height: 40 + grown * 2,
    });
    expect(node.kind === 'boundary-curve' && node.waypoints).toEqual([
      { x: grown, y: grown },
      { x: 120 + grown, y: 40 + grown },
      { x: 240 + grown, y: grown },
    ]);
  });

  it('carries a text element its own prose', () => {
    const node = nodeNamed('el-note');
    expect(node.kind === 'text' && node.text).toBe(
      'Orders are kept for seven years.',
    );
  });

  it('puts the boundaries ahead of what they enclose', () => {
    expect(layout.nodes.slice(0, 2).map((node) => node.id)).toEqual([
      id('el-zone'),
      id('el-edge-zone'),
    ]);
  });

  it('carries the badge of each element the threats name', () => {
    expect(nodeNamed('el-client').badge).toEqual({
      count: 1,
      severity: 'critical',
      secondary: 0,
    });
    expect(nodeNamed('el-note').badge).toBeUndefined();
  });

  it('anchors an attached end at the handle midpoint of the side it takes', () => {
    const edge = edgeNamed('el-request');
    const client = nodeNamed('el-client');
    expect(edge.sourceSide).toBe('right');
    expect(edge.source).toEqual(handlePositions(client).right);
    expect(edge.sourceElement).toBe(id('el-client'));
  });

  it('leaves a free end at its own position, on no side of anything', () => {
    const edge = edgeNamed('el-probe');
    expect(edge.source).toEqual({ x: 620, y: 320 });
    expect(edge.sourceSide).toBeUndefined();
    expect(edge.sourceElement).toBeUndefined();
  });

  it('bounds everything it draws', () => {
    expect(layout.bounds).toEqual({ x: 0, y: 0, width: 640, height: 410 });
  });

  it('gives a straight curve boundary an extent to pick', () => {
    const straight = curveBoundary([
      { x: 0, y: 50 },
      { x: 400, y: 50 },
    ]);
    expect(straight.size).toEqual({
      width: 400 + boundaryStrokeWidth * 2,
      height: boundaryStrokeWidth * 2,
    });
  });

  it('gives a curve boundary of one repeated point an extent to pick', () => {
    const degenerate = curveBoundary([
      { x: 20, y: 20 },
      { x: 20, y: 20 },
    ]);
    expect(degenerate.size).toEqual({
      width: boundaryStrokeWidth * 2,
      height: boundaryStrokeWidth * 2,
    });
    expect(
      degenerate.kind === 'boundary-curve' && degenerate.waypoints,
    ).toEqual([
      { x: boundaryStrokeWidth, y: boundaryStrokeWidth },
      { x: boundaryStrokeWidth, y: boundaryStrokeWidth },
    ]);
  });

  it('bounds an empty diagram at the origin', () => {
    const empty = parsedFixture({
      metadata: { title: 't', owner: '', description: '', contributors: [] },
      diagrams: [{ id: 'd', title: 'Diagram', elements: [] }],
      threats: [],
      lastIssuedThreatNumber: 0,
      mitigations: [],
      assumptions: [],
    });
    expect(layoutOf(empty)).toEqual({
      nodes: [],
      edges: [],
      unplaced: [],
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    });
  });
});

describe('layoutDiagram, choosing a side', () => {
  it('turns the source toward the first waypoint', () => {
    const model = twoBoxDiagram(
      flowBetween(attached('el-left'), attached('el-right'), [
        { x: 50, y: -300 },
      ]),
    );
    expect(layoutOf(model).edges[0].sourceSide).toBe('top');
  });

  it('turns the target toward the last waypoint', () => {
    const model = twoBoxDiagram(
      flowBetween(attached('el-left'), attached('el-right'), [
        { x: 50, y: -300 },
        { x: 450, y: 400 },
      ]),
    );
    expect(layoutOf(model).edges[0].targetSide).toBe('bottom');
  });

  it('turns each end toward the other centre where there is no waypoint', () => {
    const model = twoBoxDiagram(
      flowBetween(attached('el-left'), attached('el-right'), []),
    );
    expect(layoutOf(model).edges[0].sourceSide).toBe('right');
    expect(layoutOf(model).edges[0].targetSide).toBe('left');
  });

  it('turns an attached end toward the free position at the other end', () => {
    const model = twoBoxDiagram(
      flowBetween(
        attached('el-left'),
        { kind: 'free', position: { x: 50, y: 400 } },
        [],
      ),
    );
    expect(layoutOf(model).edges[0].sourceSide).toBe('bottom');
  });
});

describe('layoutDiagram, an end it cannot place', () => {
  const placed = layoutOf(
    twoBoxDiagram(
      {
        ...flowBetween(attached('el-left'), attached('el-right'), []),
        id: 'el-carrier',
      },
      [
        {
          ...flowBetween(attached('el-left'), attached('el-carrier'), []),
          id: 'el-rider',
        },
      ],
    ),
  );

  it('names an endpoint pointing at an element the canvas draws as no box', () => {
    expect(placed.unplaced).toEqual([
      { flow: id('el-rider'), side: 'target', element: id('el-carrier') },
    ]);
  });

  it('leaves that flow out rather than inventing geometry for it', () => {
    expect(placed.edges.map((edge) => edge.id)).toEqual([id('el-carrier')]);
  });
});
