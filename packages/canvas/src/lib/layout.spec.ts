import type { Model } from '@panoptes/model';
import { elementId, parsedFixture } from '@panoptes/model/fixtures';
import { badgeExtent } from './badges.js';
import { everyGlyphModel } from './canvas.fixtures.js';
import { handlePositions, type NodeBox } from './handles.js';
import {
  layoutDiagram,
  reanchoredFlow,
  type CanvasEdge,
  type CanvasNode,
} from './layout.js';
import { canvasNodeTypes, freeEndNodeKind } from './react-flow.js';
import { boundaryStrokeWidth } from './stylesheet.js';

const layoutOf = (model: Model) => layoutDiagram(model.diagrams[0], model);

const layout = layoutOf(everyGlyphModel);

const nodeNamed = (value: string): CanvasNode => {
  const found = layout.nodes.find((node) => node.id === elementId(value));
  if (found === undefined) {
    throw new Error(`No node ${value} in the layout`);
  }
  return found;
};

const edgeNamed = (value: string): CanvasEdge => {
  const found = layout.edges.find((edge) => edge.id === elementId(value));
  if (found === undefined) {
    throw new Error(`No edge ${value} in the layout`);
  }
  return found;
};

const elementIn = (model: Model, value: string) => {
  const found = model.diagrams[0].elements.find(
    (element) => element.id === elementId(value),
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

const curveLayout = (waypoints: unknown[]) =>
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
  );

const curveBoundary = (waypoints: unknown[]): CanvasNode =>
  curveLayout(waypoints).nodes[0];

describe('layoutDiagram', () => {
  it('lays out a node of every kind the canvas draws as a box', () => {
    expect(new Set(layout.nodes.map((node) => node.kind))).toEqual(
      new Set<string>(
        Object.keys(canvasNodeTypes).filter((kind) => kind !== freeEndNodeKind),
      ),
    );
    expect(layout.edges).toHaveLength(3);
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
      elementId('el-zone'),
      elementId('el-edge-zone'),
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
    expect(edge.sourceElement).toBe(elementId('el-client'));
  });

  it('leaves a free end at its own position, on no side of anything', () => {
    const edge = edgeNamed('el-probe');
    expect(edge.source).toEqual({ x: 620, y: 320 });
    expect(edge.sourceSide).toBeUndefined();
    expect(edge.sourceElement).toBeUndefined();
  });

  it('reports the fixture flow whose endpoint names another flow', () => {
    expect(layout.unplaced).toEqual([
      {
        flow: elementId('el-replay'),
        side: 'source',
        element: elementId('el-request'),
      },
    ]);
  });

  it('bounds everything it draws', () => {
    expect(layout.bounds).toEqual({ x: 0, y: -13, width: 653, height: 423 });
  });

  it('reaches past a node box for the badge hanging off its corner', () => {
    const zone = nodeNamed('el-zone');
    const reach = zone.badge === undefined ? 0 : badgeExtent(zone.badge).radius;
    expect(reach).toBeGreaterThan(0);
    expect(layout.bounds.y).toBe(zone.position.y - reach);
    expect(layout.bounds.x + layout.bounds.width).toBe(
      zone.position.x + zone.size.width + reach,
    );
  });

  it('bounds a sharp curve by the cubics that draw it, not by its box', () => {
    const sharp = curveLayout([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
    ]);
    const node = sharp.nodes[0];
    expect(sharp.bounds.x + sharp.bounds.width).toBeGreaterThan(
      node.position.x + node.size.width,
    );
    expect(sharp.bounds.y).toBeLessThan(node.position.y);
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
      {
        flow: elementId('el-rider'),
        side: 'target',
        element: elementId('el-carrier'),
      },
    ]);
  });

  it('leaves that flow out rather than inventing geometry for it', () => {
    expect(placed.edges.map((edge) => edge.id)).toEqual([
      elementId('el-carrier'),
    ]);
  });
});

const nodeBoxAt = (x: number, y: number): NodeBox => ({
  position: { x, y },
  size: { width: 100, height: 100 },
});

describe('reanchoredFlow', () => {
  const settled = layoutOf(
    twoBoxDiagram(flowBetween(attached('el-left'), attached('el-right'), [])),
  ).edges[0];

  const left = nodeBoxAt(0, 0);
  const right = nodeBoxAt(400, 0);

  it('gives the settled flow back where each box is where the model has it', () => {
    expect(reanchoredFlow(settled, left, right)).toEqual(settled);
  });

  it('carries the anchor of an end whose box has moved', () => {
    expect(reanchoredFlow(settled, nodeBoxAt(0, 200), right).source).toEqual({
      x: 100,
      y: 250,
    });
  });

  it('leaves the end whose box stands where it was', () => {
    expect(reanchoredFlow(settled, nodeBoxAt(0, 200), right).target).toEqual(
      settled.target,
    );
  });

  it('settles the side of both ends afresh, as the layout would', () => {
    const moved = reanchoredFlow(settled, nodeBoxAt(0, -600), right);
    expect([moved.sourceSide, moved.targetSide]).toEqual(['bottom', 'top']);
    expect([moved.source, moved.target]).toEqual([
      { x: 50, y: -500 },
      { x: 450, y: 0 },
    ]);
  });

  it('keeps the name and the badge where the whole diagram settled them', () => {
    expect(reanchoredFlow(settled, nodeBoxAt(0, 200), right).label).toBe(
      settled.label,
    );
  });

  it('keeps a free end where it is, no box carrying one', () => {
    const loose = layoutOf(
      twoBoxDiagram(
        flowBetween(
          attached('el-left'),
          { kind: 'free', position: { x: 50, y: 400 } },
          [],
        ),
      ),
    ).edges[0];
    const moved = reanchoredFlow(loose, nodeBoxAt(0, 200), undefined);
    expect(moved.target).toEqual({ x: 50, y: 400 });
    expect(moved.source).toEqual({ x: 50, y: 300 });
  });

  it('keeps both settled anchors where no box reaches it', () => {
    expect(reanchoredFlow(settled, undefined, undefined)).toEqual(settled);
  });

  it('carries a flow attached to a trust boundary as it carries any other', () => {
    const crossing = layoutOf(
      twoBoxDiagram(
        flowBetween(attached('el-left'), attached('el-fence'), []),
        [
          {
            kind: 'trust-boundary',
            id: 'el-fence',
            name: 'Fence',
            description: '',
            outOfScope: false,
            reasonOutOfScope: '',
            shape: {
              kind: 'box',
              position: { x: 400, y: 0 },
              size: { width: 100, height: 100 },
            },
          },
        ],
      ),
    ).edges[0];
    expect(reanchoredFlow(crossing, left, nodeBoxAt(400, 200)).target).toEqual({
      x: 400,
      y: 250,
    });
  });
});
