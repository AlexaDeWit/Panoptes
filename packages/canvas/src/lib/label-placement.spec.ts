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
import { layoutDiagram, type CanvasLayout, type CanvasNode } from './layout.js';
import { controlPolygon } from './paths.js';

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
