import { elementIdSchema, type Model, type Point } from '@panoptes/model';
import { badgeAnchor, badgeBox } from './badges.js';
import {
  ecluseModel,
  everyGlyphModel,
  panoptesModel,
  parsedFixture,
} from './canvas.fixtures.js';
import {
  boxesOverlap,
  boxOfPoints,
  segmentMeetsBox,
  segmentsOfBox,
  segmentsOfPolyline,
  shiftedBy,
  type Box,
  type Segment,
} from './geometry.js';
import {
  flowLabelPlacements,
  nodeTextPlacement,
  textPlacementCorners,
  type FlowGeometry,
} from './label-placement.js';
import {
  layoutDiagram,
  type CanvasBounds,
  type CanvasLayout,
  type CanvasNode,
} from './layout.js';
import { controlPolygon, smoothSegments, type CubicSegment } from './paths.js';

const id = (value: string) => elementIdSchema.parse(value);

const layoutOf = (model: Model, diagram = 0): CanvasLayout =>
  layoutDiagram(model.diagrams[diagram], model);

const isEnclosure = (node: CanvasNode): boolean =>
  node.kind === 'boundary-box' || node.kind === 'boundary-curve';

const boxOf = (node: CanvasNode): Box => ({
  minX: node.position.x,
  minY: node.position.y,
  maxX: node.position.x + node.size.width,
  maxY: node.position.y + node.size.height,
});

const outlineOf = (node: CanvasNode): Segment[] => {
  if (node.kind === 'boundary-curve') {
    return segmentsOfPolyline(
      controlPolygon(node.waypoints).map((point) =>
        shiftedBy(point, node.position),
      ),
    );
  }
  return segmentsOfBox(boxOf(node));
};

type Drawn = { readonly of: string; readonly box: Box };

const textBoxOf = (node: CanvasNode): Box | undefined =>
  boxOfPoints(
    textPlacementCorners(nodeTextPlacement(node)).map((corner) =>
      shiftedBy(corner, node.position),
    ),
  );

const elementBoxes = (layout: CanvasLayout): Drawn[] =>
  layout.nodes.flatMap((node) => {
    const text = textBoxOf(node);
    return [
      ...(isEnclosure(node) ? [] : [{ of: node.name, box: boxOf(node) }]),
      ...(text === undefined ? [] : [{ of: `${node.name} name`, box: text }]),
      ...(node.badge === undefined
        ? []
        : [
            {
              of: `${node.name} badge`,
              box: badgeBox(
                shiftedBy(badgeAnchor(node.size), node.position),
                node.badge,
              ),
            },
          ]),
    ];
  });

const drawnLines = (layout: CanvasLayout): Segment[] => [
  ...layout.nodes.filter(isEnclosure).flatMap(outlineOf),
  ...layout.edges.flatMap((edge) =>
    segmentsOfPolyline([edge.source, ...edge.waypoints, edge.target]),
  ),
];

const labelBoxes = (layout: CanvasLayout): Drawn[] =>
  layout.edges.flatMap((edge) => {
    const name = boxOfPoints(textPlacementCorners(edge.label.name));
    return [
      ...(name === undefined ? [] : [{ of: `"${edge.name}"`, box: name }]),
      ...(edge.badge === undefined || edge.label.badge === undefined
        ? []
        : [
            {
              of: `"${edge.name}" badge`,
              box: badgeBox(edge.label.badge, edge.badge),
            },
          ]),
    ];
  });

const collisionsIn = (layout: CanvasLayout): string[] => {
  const elements = elementBoxes(layout);
  const lines = drawnLines(layout);
  const labels = labelBoxes(layout);
  return labels.flatMap((label, index) => [
    ...elements
      .filter((element) => boxesOverlap(label.box, element.box))
      .map((element) => `${label.of} over the element ${element.of}`),
    ...labels
      .slice(index + 1)
      .filter((other) => boxesOverlap(label.box, other.box))
      .map((other) => `${label.of} over ${other.of}`),
    ...lines
      .filter((line) => segmentMeetsBox(line, label.box))
      .map(() => `${label.of} across a line`),
  ]);
};

const placementsById = (layout: CanvasLayout): [string, Point][] =>
  layout.edges.map((edge) => [edge.id, edge.label.name.at]);

const boxAt = (
  value: string,
  x: number,
  y: number,
  kind = 'actor',
  size = { width: 120, height: 80 },
) => ({
  kind,
  id: value,
  name: value,
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x, y },
  size,
});

const flowFrom = (
  value: string,
  source: string,
  target: string,
  name = value,
) => ({
  kind: 'flow',
  id: value,
  name,
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  source: { kind: 'attached', element: source },
  target: { kind: 'attached', element: target },
  waypoints: [],
});

const curveOf = (value: string, waypoints: readonly Point[], name: string) => ({
  kind: 'trust-boundary',
  id: value,
  name,
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  shape: { kind: 'curve', waypoints },
});

const diagramOf = (elements: unknown[]): Model =>
  parsedFixture({
    metadata: { title: 't', owner: '', description: '', contributors: [] },
    diagrams: [{ id: 'd', title: 'Diagram', elements }],
    threats: [],
    lastIssuedThreatNumber: 0,
    mitigations: [],
    assumptions: [],
  });

const ecluseLayout = layoutOf(ecluseModel);

const scenes: readonly {
  readonly name: string;
  readonly layout: CanvasLayout;
}[] = [
  { name: 'the Écluse diagram', layout: ecluseLayout },
  { name: 'every glyph', layout: layoutOf(everyGlyphModel) },
  {
    name: 'the Panoptes read and render diagram',
    layout: layoutOf(panoptesModel, 0),
  },
  {
    name: 'the Panoptes agent and desktop diagram',
    layout: layoutOf(panoptesModel, 1),
  },
];

const curveSamples = 64;

const dividerName = 'a divider named at length, over more than one line';

const onCubic = (from: Point, cubic: CubicSegment, at: number): Point => {
  const rest = 1 - at;
  const weights = [rest ** 3, 3 * rest ** 2 * at, 3 * rest * at ** 2, at ** 3];
  const controls = [from, cubic.firstControl, cubic.secondControl, cubic.end];
  return {
    x: controls.reduce(
      (sum, point, index) => sum + point.x * weights[index],
      0,
    ),
    y: controls.reduce(
      (sum, point, index) => sum + point.y * weights[index],
      0,
    ),
  };
};

const drawnCurve = (waypoints: readonly Point[]): Point[] =>
  smoothSegments(waypoints).flatMap((cubic, index) =>
    Array.from({ length: curveSamples + 1 }, (_unused, step) =>
      onCubic(waypoints[index], cubic, step / curveSamples),
    ),
  );

const curveRuns = (node: CanvasNode): Segment[] =>
  node.kind === 'boundary-curve'
    ? segmentsOfPolyline(
        drawnCurve(node.waypoints).map((point) =>
          shiftedBy(point, node.position),
        ),
      )
    : [];

const nameStruckBy = (node: CanvasNode): string[] => {
  const box = textBoxOf(node);
  return box === undefined
    ? []
    : curveRuns(node)
        .filter((run) => segmentMeetsBox(run, box))
        .map(() => `${node.name} over its own curve`);
};

const layoutOfCurve = (
  waypoints: readonly Point[],
  name = dividerName,
): CanvasLayout =>
  layoutOf(diagramOf([curveOf('el-divider', waypoints, name)]));

const rightEdge = (bounds: CanvasBounds): number => bounds.x + bounds.width;

const curveOrientations = [
  [
    'vertical',
    [
      { x: 0, y: 0 },
      { x: 60, y: 200 },
      { x: 0, y: 400 },
    ],
    dividerName,
  ],
  [
    'horizontal',
    [
      { x: 0, y: 0 },
      { x: 200, y: 60 },
      { x: 400, y: 0 },
    ],
    dividerName,
  ],
  [
    'diagonal',
    [
      { x: 0, y: 0 },
      { x: 200, y: 140 },
      { x: 400, y: 400 },
    ],
    dividerName,
  ],
  [
    'arched, 300 wide and 100 tall',
    [
      { x: 0, y: 100 },
      { x: 150, y: 0 },
      { x: 300, y: 100 },
    ],
    'Untrusted callers',
  ],
  [
    'arched, 120 wide and 40 tall under a long name',
    [
      { x: 0, y: 40 },
      { x: 60, y: 0 },
      { x: 120, y: 40 },
    ],
    'a boundary with a fairly long name',
  ],
  [
    'vertical and opening to the right',
    [
      { x: 40, y: 0 },
      { x: 0, y: 200 },
      { x: 40, y: 400 },
    ],
    dividerName,
  ],
] as const;

describe(`a curve boundary's name, over every cubic sampled ${curveSamples} times`, () => {
  it.each(curveOrientations)(
    'clears a curve %s',
    (_orientation, waypoints, name) => {
      expect(nameStruckBy(layoutOfCurve(waypoints, name).nodes[0])).toEqual([]);
    },
  );

  it.each(scenes)(
    'clears every curve $name draws, and some draw none',
    ({ layout }) => {
      expect(layout.nodes.flatMap(nameStruckBy)).toEqual([]);
    },
  );

  it('takes its side from the waypoints, not the end drawn from', () => {
    const down = layoutOfCurve([
      { x: 0, y: 0 },
      { x: 60, y: 200 },
      { x: 0, y: 400 },
    ]).nodes[0];
    const up = layoutOfCurve([
      { x: 0, y: 400 },
      { x: 60, y: 200 },
      { x: 0, y: 0 },
    ]).nodes[0];
    expect(nodeTextPlacement(up).at).toEqual(nodeTextPlacement(down).at);
  });

  it('is reached by the bounds the layout reports', () => {
    const layout = layoutOfCurve(curveOrientations[0][1]);
    expect(rightEdge(layout.bounds)).toBe(textBoxOf(layout.nodes[0])?.maxX);
  });

  it('sits on the outside of the bend, not inside it', () => {
    const arch = layoutOfCurve(curveOrientations[3][1], 'Untrusted callers');
    const bowl = layoutOfCurve([
      { x: 0, y: 0 },
      { x: 150, y: 100 },
      { x: 300, y: 0 },
    ]);
    expect(nodeTextPlacement(arch.nodes[0]).at.y).toBeLessThan(0);
    expect(nodeTextPlacement(bowl.nodes[0]).at.y).toBeGreaterThan(100);
  });
});

describe('the flow labels of a whole diagram', () => {
  it.each(scenes)('leaves nothing overlapping on $name', ({ layout }) => {
    expect(collisionsIn(layout)).toEqual([]);
  });

  it.each(scenes)('names every flow $name carries', ({ layout }) => {
    expect(labelBoxes(layout).length).toBeGreaterThanOrEqual(
      layout.edges.length,
    );
  });
});

describe('two flows between one pair of elements', () => {
  const layout = layoutOf(
    diagramOf([
      boxAt('el-left', 0, 0),
      boxAt('el-right', 460, 0),
      flowFrom('el-out', 'el-left', 'el-right', 'ship the parcel'),
      flowFrom('el-back', 'el-right', 'el-left', 'return the parcel'),
    ]),
  );

  it('shares one segment between them', () => {
    const [first, second] = layout.edges;
    expect(first.source).toEqual(second.target);
    expect(first.target).toEqual(second.source);
  });

  it('carries their names on opposite sides of it', () => {
    const [ship, back] = layout.edges;
    const line = ship.source.y;
    expect(back.label.name.at.y).toBeGreaterThan(line);
    expect(ship.label.name.at.y).toBeLessThan(line);
  });

  it('leaves nothing overlapping', () => {
    expect(collisionsIn(layout)).toEqual([]);
  });
});

describe('three flows converging on one element', () => {
  const layout = layoutOf(
    diagramOf([
      boxAt('el-hub', 400, 300),
      boxAt('el-one', 0, 0),
      boxAt('el-two', 0, 300),
      boxAt('el-three', 0, 600),
      flowFrom('el-a', 'el-one', 'el-hub', 'mint a token for the caller'),
      flowFrom('el-b', 'el-two', 'el-hub', 'mint a token for the worker'),
      flowFrom('el-c', 'el-three', 'el-hub', 'mint a token for the pilot'),
    ]),
  );

  it('leaves nothing overlapping', () => {
    expect(collisionsIn(layout)).toEqual([]);
  });
});

describe('a long diagonal crossing another flow', () => {
  const layout = layoutOf(
    diagramOf([
      boxAt('el-nw', 0, 0),
      boxAt('el-se', 600, 500),
      boxAt('el-ne', 600, 0),
      boxAt('el-sw', 0, 500),
      flowFrom('el-falling', 'el-nw', 'el-se', 'prune the stale versions'),
      flowFrom('el-rising', 'el-sw', 'el-ne', 'push the rebuilt index'),
    ]),
  );

  it('leaves nothing overlapping', () => {
    expect(collisionsIn(layout)).toEqual([]);
  });
});

describe('a label beside a store', () => {
  const layout = layoutOf(
    diagramOf([
      boxAt('el-worker', 0, 300),
      boxAt('el-store', 400, 280, 'store', { width: 200, height: 120 }),
      boxAt('el-far', 900, 300),
      flowFrom('el-past', 'el-worker', 'el-far', 'read through to the origin'),
      flowFrom('el-into', 'el-worker', 'el-store', 'write the mirrored copy'),
    ]),
  );

  it('leaves nothing overlapping', () => {
    expect(collisionsIn(layout)).toEqual([]);
  });
});

describe('the placement as a function of the model alone', () => {
  it('answers two flows of one id in the order it was handed them', () => {
    const twin = (name: string): FlowGeometry => ({
      id: id('el-twin'),
      name,
      badge: undefined,
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
    });
    const placed = flowLabelPlacements([twin('first'), twin('second')], []);
    expect(placed.map((placement) => placement.name.text)).toEqual([
      'first',
      'second',
    ]);
  });

  it('places a flow of one point beside the point it stands at', () => {
    const still = { x: 40, y: 60 };
    const [placement] = flowLabelPlacements(
      [
        {
          id: id('el-dot'),
          name: 'a flow of one point',
          badge: undefined,
          points: [still],
        },
      ],
      [],
    );
    expect(placement.name.at.x).toBe(still.x);
    expect(placement.name.at.y).toBeGreaterThan(still.y);
  });

  it('lays the Écluse diagram out the same way twice', () => {
    expect(placementsById(layoutOf(ecluseModel))).toEqual(
      placementsById(layoutOf(ecluseModel)),
    );
  });

  it('follows the flow ids, not the order the model holds them in', () => {
    const elements = [
      boxAt('el-left', 0, 0),
      boxAt('el-right', 460, 0),
      flowFrom('el-out', 'el-left', 'el-right', 'ship the parcel'),
      flowFrom('el-back', 'el-right', 'el-left', 'return the parcel'),
    ];
    const forwards = layoutOf(diagramOf(elements));
    const backwards = layoutOf(
      diagramOf([elements[0], elements[1], elements[3], elements[2]]),
    );
    expect(new Map(placementsById(backwards))).toEqual(
      new Map(placementsById(forwards)),
    );
  });

  it('places a flow with no name at all beside its line', () => {
    const layout = layoutOf(
      diagramOf([
        boxAt('el-left', 0, 0),
        boxAt('el-right', 460, 0),
        { ...flowFrom('el-quiet', 'el-left', 'el-right'), name: '' },
      ]),
    );
    expect(textPlacementCorners(layout.edges[0].label.name)).toEqual([]);
    expect(layout.edges[0].label.name.at.y).toBeGreaterThan(0);
  });

  it('places a flow whose ends sit on one point', () => {
    const layout = layoutOf(
      diagramOf([
        boxAt('el-still', 0, 0),
        {
          ...flowFrom('el-loop', 'el-still', 'el-still'),
          source: { kind: 'free', position: { x: 300, y: 300 } },
          target: { kind: 'free', position: { x: 300, y: 300 } },
          name: 'a flow of no length at all',
        },
      ]),
    );
    expect(layout.edges[0].label.name.at.y).toBeGreaterThan(300);
  });

  it('keeps the label of a flow it cannot place clear inside a crowd', () => {
    const layout = layoutOf(
      diagramOf([
        boxAt('el-a', 0, 0, 'actor', { width: 300, height: 300 }),
        boxAt('el-b', 300, 0, 'actor', { width: 300, height: 300 }),
        boxAt('el-c', 0, 300, 'actor', { width: 300, height: 300 }),
        boxAt('el-d', 300, 300, 'actor', { width: 300, height: 300 }),
        flowFrom('el-boxed', 'el-a', 'el-d', 'nowhere at all to put this'),
      ]),
    );
    expect(layout.edges).toHaveLength(1);
    expect(collisionsIn(layout).length).toBeGreaterThan(0);
  });
});

describe('the id of every fixture flow', () => {
  it('reads as an element id', () => {
    expect(ecluseLayout.edges.map((edge) => edge.id)).toContain(
      id('f2d6c311-b8b3-4a9f-bef7-b78e4adaa17e'),
    );
  });
});
