import type { ElementId, Point, Size } from '@panoptes/model';
import {
  badgeAnchor,
  badgeBox,
  badgeExtent,
  type ThreatBadge,
} from './badges.js';
import {
  boxesOverlap,
  boxMeetsCircle,
  boxOfPoints,
  segmentMeetsBox,
  segmentsOfBox,
  segmentsOfPolyline,
  shiftedBy,
  type Box,
  type Circle,
  type Segment,
} from './geometry.js';
import type { TextAnchor } from './labels.js';
import type { CanvasNode } from './layout.js';
import { controlPolygon, sampledCurve } from './paths.js';
import { wrappedTextStyles, type WrappedTextStyle } from './stylesheet.js';
import {
  flowLabelClearance,
  innerWidth,
  looseLabelWidth,
  textExtent,
  textPadding,
  wrapText,
  type TextExtent,
} from './typography.js';

const anchorFractions = [0.5, 0.25, 0.75];

const standoffSteps = [0, 1, 2];

const normalSides = [1, -1];

/**
 * One run of text a glyph draws: what it says, where it hangs, and the two
 * numbers the wrap needs. It is exactly what the `WrappedText` component takes, so a
 * glyph spreads it rather than restating it, and a caller sizing a picture
 * measures the same placement the glyph drew.
 */
export type TextPlacement = {
  readonly text: string;
  readonly at: Point;
  readonly anchor: TextAnchor;
  readonly width: number;
  readonly textStyle: WrappedTextStyle;
};

/**
 * Which bend of a curve carries its name and on which side of that bend: the
 * index of the waypoint the name hangs beside, and whether the side is the
 * mirror of the convex one there.
 */
export type CurveNameSide = {
  readonly at: number;
  readonly mirrored: boolean;
};

/**
 * The run of text one node's glyph draws, in the node's own coordinates: a
 * text element's prose, a box boundary's name below its top edge, a curve
 * boundary's name beside one of its waypoints, and every other kind's name
 * centred in its box. A process wraps to the width of the square inscribed
 * in its circle rather than to its box.
 *
 * A curve's name hangs off the unit normal of the drawn curve's tangent at
 * the waypoint it is anchored on, a clearance plus the name's extent
 * projected onto that normal, so its box clears that tangent by the
 * clearance and a curve dividing two lanes carries its name beside the
 * dashes rather than under them. The tangent is the run from the waypoint
 * before to the one after with the ends repeated where a neighbour is
 * missing, which is the tangent Catmull-Rom gives the cubic there. Of the
 * two normals the convex one points away from the bend, so the arms of the
 * curve lead away from a name on that side rather than back across it, and
 * where the bend lies along the tangent, which a straight run gives, the
 * normal with a non-negative y is the curve's own and where that y is zero
 * the one with a positive x, the rule a flow's name follows.
 *
 * The candidates a curve's name is offered, in order, are the convex side of
 * the middle waypoint, then its mirror, then both sides of each further
 * bend, walking outwards from the middle a waypoint at a time and taking at
 * each distance the bend nearer the origin first, by x and then by y. The
 * middle waypoint is the central one of an odd run, and of an even run's two
 * central ones the one nearer the origin the same way, which is a waypoint
 * rather than a point between two, so the anchor lies on the curve.
 * {@link settledCurveNames} walks that list over the whole diagram and
 * leaves the answer on the node as `nameSide`, so this stays a function of
 * the node alone and the glyph and the drawn extent read one placement. A
 * node carrying no side takes the convex side of the middle waypoint, which
 * is also where a curve with no clear candidate anywhere ends up: a name has
 * to be drawn somewhere, and the collision it leaves is one the suite
 * reports rather than one the picture hides.
 *
 * Reversing a curve's waypoints leaves the anchor, the bend, the normal and
 * the order of the walk alone, so the placement is fixed by the waypoints
 * and not by the end the curve is drawn from.
 */
export function nodeTextPlacement(node: CanvasNode): TextPlacement {
  if (node.kind === 'text') {
    return {
      text: node.text,
      at: boxCentre(node.size),
      anchor: 'centre',
      width: innerWidth(node.size.width),
      textStyle: 'note',
    };
  }
  if (node.kind === 'boundary-box') {
    return {
      text: node.name,
      at: {
        x: node.size.width / 2,
        y: textPadding + wrappedTextStyles.label.fontSize / 2,
      },
      anchor: 'top',
      width: innerWidth(node.size.width),
      textStyle: 'label',
    };
  }
  if (node.kind === 'boundary-curve') {
    return curveNamePlacement(node);
  }
  if (node.kind === 'process') {
    return {
      text: node.name,
      at: boxCentre(node.size),
      anchor: 'centre',
      width: innerWidth(
        Math.min(node.size.width, node.size.height) * Math.SQRT1_2,
      ),
      textStyle: 'label',
    };
  }
  return {
    text: node.name,
    at: boxCentre(node.size),
    anchor: 'centre',
    width: innerWidth(node.size.width),
    textStyle: 'label',
  };
}

/**
 * The circle a process's glyph draws, in the node's own coordinates: centred
 * in the node's box, of the radius that inscribes it in the shorter side.
 * The glyph draws it and the placement search charges a label for it, so the
 * shape a reader sees is the shape a label is held clear of.
 *
 * The stroke straddles this circle and is left out of it, the way an
 * element's box leaves out its own outline's stroke.
 */
export function processCircle(size: Size): Circle {
  return {
    centre: boxCentre(size),
    radius: Math.min(size.width, size.height) / 2,
  };
}

/**
 * The two opposite corners of the box a placement's text fills, wrapped and
 * measured the way `WrappedText` lays it out. Text that wraps to no
 * line at all, which is what an empty name gives, occupies nothing and comes
 * back as no corners.
 */
export function textPlacementCorners(
  placement: TextPlacement,
): readonly Point[] {
  const rule = wrappedTextStyles[placement.textStyle];
  const lines = wrapText(placement.text, rule.fontSize, placement.width);
  if (lines.length === 0) {
    return [];
  }
  const extent = textExtent(lines, rule.fontSize);
  const top =
    placement.anchor === 'top'
      ? placement.at.y - rule.fontSize / 2
      : placement.at.y - extent.height / 2;
  return [
    { x: placement.at.x - extent.width / 2, y: top },
    { x: placement.at.x + extent.width / 2, y: top + extent.height },
  ];
}

/**
 * The given nodes with every curve boundary's name settled on one bend of
 * its curve and one side of that bend, the first candidate of the order
 * {@link nodeTextPlacement} states that is clear of the drawn curve, of the
 * shape every element draws and of every element's badge, since a name under
 * a badge or over a glyph cannot be read.
 *
 * The curve is the polyline {@link sampledCurve} takes through the ink
 * rather than the control polygon, which can pass outside a box the curve
 * runs through. The standoff holds a name clear of the tangent at its bend
 * on either side, and the convex side carries that over to the drawn curve,
 * but the mirror sits inside the turn where the arms lead back, so a tight
 * arch's mirror crosses its own ink and only the sampled test catches it.
 *
 * Element names are not consulted, and neither are the flow labels, which
 * are placed after this and already count a curve's text box among their
 * obstacles. Every candidate is fixed by the waypoints and the obstacles are
 * the shapes the model's own elements draw, so reversing a curve's
 * waypoints, or holding the elements in another order, gives the same side.
 */
export function settledCurveNames(
  nodes: readonly CanvasNode[],
): readonly CanvasNode[] {
  const blocked = elementSolids(nodes);
  return nodes.map((node) =>
    node.kind === 'boundary-curve'
      ? { ...node, nameSide: settledSide(node, blocked) }
      : node,
  );
}

/**
 * Where a flow's name and badge hang. `badge` is absent for a flow no open
 * threat names.
 */
export type FlowLabelPlacement = {
  readonly name: TextPlacement;
  readonly badge: Point | undefined;
};

/**
 * What placing one flow's label needs of that flow: which flow it is, what
 * its name says, the badge it carries, and the points its line runs through.
 * A flow has at least the one point its label hangs beside, so the type
 * carries that rather than the search having to answer for a line that is
 * nowhere.
 */
export type FlowGeometry = {
  readonly id: ElementId;
  readonly name: string;
  readonly badge: ThreatBadge | undefined;
  readonly points: readonly [Point, ...Point[]];
};

/**
 * Where every flow of one diagram hangs its name and its badge, each put
 * where nothing else is drawn. The search reads the whole diagram rather
 * than one flow, because what a label has to keep clear of is the other
 * flows, the elements, and the labels already placed.
 *
 * A flow offers a candidate at the midpoint and the quarter points of each
 * of its segments, on either side of that segment's own normal, at three
 * standoffs a clearance apart. A candidate costs one for every element
 * shape, element name and element badge its own name or badge box overlaps,
 * one for every straight run of a drawn line that meets either box, and one
 * for every name or badge already placed that either box overlaps.
 *
 * An element is charged as the shape its glyph draws, measured by the
 * function that draws it: an actor, a store and a text element as their
 * boxes, a process as the circle {@link processCircle} inscribes in its box.
 * A label in a corner of a process's box therefore costs nothing for that
 * process, which is the white space a reader sees there. The element
 * occupies that shape, its run of text and its badge, so a label over an
 * element's name costs both; a trust boundary occupies its outline alone,
 * its four sides or the polygon its curve's control points trace, since it
 * encloses what it is drawn around and a label inside it is where it
 * belongs. The drawn lines are those outlines and every flow's own polyline,
 * and a flow's own line counts as much as another's, which costs nothing at
 * the standoff that put the label beside it and does cost where the flow
 * doubles back under its own name.
 *
 * Every badge already drawn is grown by one clearance on every side where a
 * candidate's own badge box is tested against it, an element's and a flow
 * label's alike, so a flow badge that comes within a clearance of another
 * badge costs as much as one drawn over it. Two circles that close together
 * read as one element's own stacked pair rather than as two labels. The
 * candidate's name box is tested against every badge as it is drawn,
 * ungrown, since text beside a badge is still read as text.
 *
 * Flows are placed in ascending order of their ids, so the order the model
 * happens to hold its elements in decides nothing, and the cheapest
 * candidate wins. A tie goes to the candidate nearest the midpoint of the
 * flow's longest segment, then to the flow's own placement beside that
 * midpoint, then to the first candidate in the order above, which takes the
 * side the segment's normal names. Nothing is measured and nothing is
 * random, so one diagram gives one set of placements on every run.
 *
 * A label with no clear candidate anywhere takes the cheapest one rather
 * than being dropped, so a dense diagram still draws every name it carries.
 *
 * What comes back is one placement per flow, in the order the flows were
 * given, whatever order they were placed in.
 */
export function flowLabelPlacements(
  flows: readonly FlowGeometry[],
  nodes: readonly CanvasNode[],
): FlowLabelPlacement[] {
  const ordered = flows.map((flow, index) => ({ flow, index }));
  ordered.sort((one, other) => byIdAscending(one.flow, other.flow));
  const placements: FlowLabelPlacement[] = [];
  let drawn = drawnObstacles(flows, nodes);
  for (const { flow, index } of ordered) {
    const chosen = cheapestCandidate(flow, drawn);
    placements[index] = chosen.placement;
    drawn = withLabelPlaced(drawn, chosen);
  }
  return placements;
}

type Candidate = {
  readonly placement: FlowLabelPlacement;
  readonly nameBox: Box | undefined;
  readonly badgeBox: Box | undefined;
  readonly fromMiddle: number;
};

type Solids = {
  readonly boxes: readonly Box[];
  readonly circles: readonly Circle[];
  readonly lines: readonly Segment[];
};

type Obstacles = {
  readonly forName: Solids;
  readonly forBadge: Solids;
};

type BoundaryCurve = Extract<CanvasNode, { readonly kind: 'boundary-curve' }>;

type Bend = {
  readonly before: Point;
  readonly middle: Point;
  readonly after: Point;
};

function curveNamePlacement(node: BoundaryCurve): TextPlacement {
  const side = node.nameSide ?? convexMiddle(node.waypoints);
  const bend = bendAt(node.waypoints, side.at);
  const convex = convexNormal(bend);
  return nameBeside(
    node.name,
    bend.middle,
    side.mirrored ? negated(convex) : convex,
    flowLabelClearance,
    'label',
  );
}

function convexMiddle(waypoints: readonly Point[]): CurveNameSide {
  return { at: middleWaypoint(waypoints), mirrored: false };
}

function middleWaypoint(waypoints: readonly Point[]): number {
  const at = Math.floor(waypoints.length / 2);
  if (waypoints.length % 2 === 1) {
    return at;
  }
  return nearerOrigin(waypoints[at - 1], waypoints[at]) ? at - 1 : at;
}

function nearerOrigin(one: Point, other: Point): boolean {
  return one.x < other.x || (one.x === other.x && one.y < other.y);
}

function bendAt(waypoints: readonly Point[], at: number): Bend {
  return {
    before: waypoints[Math.max(0, at - 1)],
    middle: waypoints[at],
    after: waypoints[Math.min(waypoints.length - 1, at + 1)],
  };
}

function convexNormal(bend: Bend): Point {
  const normal = labelNormal({ from: bend.before, to: bend.after });
  const into =
    (bend.after.x + bend.before.x - bend.middle.x * 2) * normal.x +
    (bend.after.y + bend.before.y - bend.middle.y * 2) * normal.y;
  return into > 0 ? negated(normal) : normal;
}

function boxCentre(size: Size): Point {
  return { x: size.width / 2, y: size.height / 2 };
}

function settledSide(node: BoundaryCurve, elements: Solids): CurveNameSide {
  const obstacles = withOwnCurve(node, elements);
  const clear = sidesInOrder(node.waypoints).find(
    (side) => !nameMeetsAny(node, side, obstacles),
  );
  return clear ?? convexMiddle(node.waypoints);
}

function sidesInOrder(waypoints: readonly Point[]): CurveNameSide[] {
  return bendsInOrder(waypoints).flatMap((at) => [
    { at, mirrored: false },
    { at, mirrored: true },
  ]);
}

function bendsInOrder(waypoints: readonly Point[]): number[] {
  const middle = middleWaypoint(waypoints);
  const steps = Math.max(middle, waypoints.length - 1 - middle);
  return [
    middle,
    ...Array.from({ length: steps }, (_unused, step) =>
      bendsEitherSide(waypoints, middle, step + 1),
    ).flat(),
  ];
}

function bendsEitherSide(
  waypoints: readonly Point[],
  middle: number,
  step: number,
): number[] {
  const held = [middle - step, middle + step].filter(
    (at) => at >= 0 && at < waypoints.length,
  );
  return held.length === 2 &&
    nearerOrigin(waypoints[held[1]], waypoints[held[0]])
    ? [held[1], held[0]]
    : held;
}

function nameMeetsAny(
  node: BoundaryCurve,
  side: CurveNameSide,
  obstacles: Solids,
): boolean {
  const [box] = ownTextBox({ ...node, nameSide: side });
  return box !== undefined && meetsAny(box, obstacles);
}

function withOwnCurve(node: BoundaryCurve, solids: Solids): Solids {
  return {
    ...solids,
    lines: [
      ...solids.lines,
      ...segmentsOfPolyline(
        sampledCurve(node.waypoints).map((point) =>
          shiftedBy(point, node.position),
        ),
      ),
    ],
  };
}

function elementSolids(nodes: readonly CanvasNode[]): Solids {
  const outlines = nodes.map(nodeOutline);
  return {
    boxes: [
      ...outlines.flatMap((outline) => outline.boxes),
      ...nodes.flatMap(ownBadgeBox),
    ],
    circles: outlines.flatMap((outline) => outline.circles),
    lines: [],
  };
}

function meetsAny(box: Box, solids: Solids): boolean {
  return boxCollisions(box, solids) > 0;
}

function byIdAscending(one: FlowGeometry, other: FlowGeometry): number {
  if (one.id === other.id) {
    return 0;
  }
  return one.id < other.id ? -1 : 1;
}

function cheapestCandidate(flow: FlowGeometry, drawn: Obstacles): Candidate {
  const segments = segmentsOfPolyline(flow.points);
  const home = homeSegment(flow.points, segments);
  const middle = alongSegment(home, 0.5);
  let best = candidateAt(flow, home, 0.5, 0, 1, middle);
  let cost = collisionsOf(best, drawn);
  for (const next of candidatesOf(flow, segments, middle)) {
    const held = collisionsOf(next, drawn);
    if (held < cost || (held === cost && next.fromMiddle < best.fromMiddle)) {
      best = next;
      cost = held;
    }
  }
  return best;
}

function candidatesOf(
  flow: FlowGeometry,
  segments: readonly Segment[],
  middle: Point,
): Candidate[] {
  return segments.flatMap((segment) =>
    anchorFractions.flatMap((fraction) =>
      standoffSteps.flatMap((step) =>
        normalSides.map((side) =>
          candidateAt(flow, segment, fraction, step, side, middle),
        ),
      ),
    ),
  );
}

function candidateAt(
  flow: FlowGeometry,
  segment: Segment,
  fraction: number,
  step: number,
  side: number,
  middle: Point,
): Candidate {
  const anchor = alongSegment(segment, fraction);
  const normal = scaledBy(labelNormal(segment), side);
  const standoff = flowLabelClearance * (step + 1);
  const name = nameBeside(flow.name, anchor, normal, standoff, 'flowLabel');
  const nameBox = boxOfPoints(textPlacementCorners(name));
  const badge = badgeBeside(flow.badge, anchor, negated(normal), standoff);
  return {
    placement: { name, badge: badge?.at },
    nameBox,
    badgeBox: badge?.box,
    fromMiddle: Math.hypot(name.at.x - middle.x, name.at.y - middle.y),
  };
}

function withLabelPlaced(drawn: Obstacles, candidate: Candidate): Obstacles {
  const name = candidate.nameBox === undefined ? [] : [candidate.nameBox];
  const badge = candidate.badgeBox === undefined ? [] : [candidate.badgeBox];
  return {
    forName: withBoxes(drawn.forName, [...name, ...badge]),
    forBadge: withBoxes(drawn.forBadge, [
      ...name,
      ...badge.map(grownByClearance),
    ]),
  };
}

function withBoxes(solids: Solids, boxes: readonly Box[]): Solids {
  return { ...solids, boxes: [...solids.boxes, ...boxes] };
}

function badgeBeside(
  badge: ThreatBadge | undefined,
  anchor: Point,
  direction: Point,
  standoff: number,
): { readonly at: Point; readonly box: Box } | undefined {
  if (badge === undefined) {
    return undefined;
  }
  const at = offsetBy(
    anchor,
    direction,
    standoff + badgeReach(badge, direction),
  );
  return { at, box: badgeBox(at, badge) };
}

function collisionsOf(candidate: Candidate, drawn: Obstacles): number {
  return (
    boxCollisions(candidate.nameBox, drawn.forName) +
    boxCollisions(candidate.badgeBox, drawn.forBadge)
  );
}

function boxCollisions(box: Box | undefined, solids: Solids): number {
  if (box === undefined) {
    return 0;
  }
  return (
    solids.boxes.filter((other) => boxesOverlap(box, other)).length +
    solids.circles.filter((circle) => boxMeetsCircle(box, circle)).length +
    solids.lines.filter((line) => segmentMeetsBox(line, box)).length
  );
}

function drawnObstacles(
  flows: readonly FlowGeometry[],
  nodes: readonly CanvasNode[],
): Obstacles {
  const outlines = nodes.map(nodeOutline);
  const boxes = [
    ...outlines.flatMap((outline) => outline.boxes),
    ...nodes.flatMap(ownTextBox),
  ];
  const badges = nodes.flatMap(ownBadgeBox);
  const circles = outlines.flatMap((outline) => outline.circles);
  const lines = [
    ...outlines.flatMap((outline) => outline.lines),
    ...flows.flatMap((flow) => segmentsOfPolyline(flow.points)),
  ];
  return {
    forName: { boxes: [...boxes, ...badges], circles, lines },
    forBadge: {
      boxes: [...boxes, ...badges.map(grownByClearance)],
      circles,
      lines,
    },
  };
}

function grownByClearance(box: Box): Box {
  return {
    minX: box.minX - flowLabelClearance,
    minY: box.minY - flowLabelClearance,
    maxX: box.maxX + flowLabelClearance,
    maxY: box.maxY + flowLabelClearance,
  };
}

function nodeOutline(node: CanvasNode): Solids {
  if (node.kind === 'boundary-box') {
    return { boxes: [], circles: [], lines: segmentsOfBox(nodeBox(node)) };
  }
  if (node.kind === 'boundary-curve') {
    return {
      boxes: [],
      circles: [],
      lines: segmentsOfPolyline(
        controlPolygon(node.waypoints).map((point) =>
          shiftedBy(point, node.position),
        ),
      ),
    };
  }
  if (node.kind === 'process') {
    return { boxes: [], circles: [placedCircle(node)], lines: [] };
  }
  return { boxes: [nodeBox(node)], circles: [], lines: [] };
}

function placedCircle(node: CanvasNode): Circle {
  const circle = processCircle(node.size);
  return {
    centre: shiftedBy(circle.centre, node.position),
    radius: circle.radius,
  };
}

function ownTextBox(node: CanvasNode): Box[] {
  const box = boxOfPoints(
    textPlacementCorners(nodeTextPlacement(node)).map((corner) =>
      shiftedBy(corner, node.position),
    ),
  );
  return box === undefined ? [] : [box];
}

function ownBadgeBox(node: CanvasNode): Box[] {
  return node.badge === undefined
    ? []
    : [badgeBox(shiftedBy(badgeAnchor(node.size), node.position), node.badge)];
}

function nodeBox(node: CanvasNode): Box {
  return {
    minX: node.position.x,
    minY: node.position.y,
    maxX: node.position.x + node.size.width,
    maxY: node.position.y + node.size.height,
  };
}

function homeSegment(
  points: readonly [Point, ...Point[]],
  segments: readonly Segment[],
): Segment {
  let longest: Segment = { from: points[0], to: points[0] };
  for (const segment of segments) {
    if (squaredLength(segment) > squaredLength(longest)) {
      longest = segment;
    }
  }
  return longest;
}

function squaredLength(segment: Segment): number {
  return (
    (segment.to.x - segment.from.x) ** 2 + (segment.to.y - segment.from.y) ** 2
  );
}

function alongSegment(segment: Segment, fraction: number): Point {
  return {
    x: segment.from.x + (segment.to.x - segment.from.x) * fraction,
    y: segment.from.y + (segment.to.y - segment.from.y) * fraction,
  };
}

function labelNormal(segment: Segment): Point {
  const run = {
    x: segment.to.x - segment.from.x,
    y: segment.to.y - segment.from.y,
  };
  const length = Math.hypot(run.x, run.y);
  const along =
    length === 0 ? { x: 1, y: 0 } : { x: run.x / length, y: run.y / length };
  const normal = { x: -along.y, y: along.x };
  return normal.y < 0 || (normal.y === 0 && normal.x < 0)
    ? negated(normal)
    : normal;
}

function negated(point: Point): Point {
  return scaledBy(point, -1);
}

function scaledBy(point: Point, factor: number): Point {
  return { x: point.x * factor, y: point.y * factor };
}

function offsetBy(at: Point, direction: Point, distance: number): Point {
  return {
    x: at.x + direction.x * distance,
    y: at.y + direction.y * distance,
  };
}

function nameBeside(
  name: string,
  anchor: Point,
  normal: Point,
  standoff: number,
  textStyle: WrappedTextStyle,
): TextPlacement {
  const fontSize = wrappedTextStyles[textStyle].fontSize;
  const extent = textExtent(
    wrapText(name, fontSize, looseLabelWidth),
    fontSize,
  );
  return {
    text: name,
    at: offsetBy(
      anchor,
      normal,
      standoff + projectedHalfExtent(extent, normal),
    ),
    anchor: 'centre',
    width: looseLabelWidth,
    textStyle,
  };
}

function projectedHalfExtent(extent: TextExtent, normal: Point): number {
  return (
    (extent.width / 2) * Math.abs(normal.x) +
    (extent.height / 2) * Math.abs(normal.y)
  );
}

function badgeReach(badge: ThreatBadge, direction: Point): number {
  const extent = badgeExtent(badge);
  const across =
    direction.y < 0 ? extent.depth * -direction.y : extent.radius * direction.y;
  return extent.radius * Math.abs(direction.x) + across;
}
