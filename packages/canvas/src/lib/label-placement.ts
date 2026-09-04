import type { ElementId, Point, Size } from '@panoptes/model';
import {
  badgeAnchor,
  badgeBox,
  badgeExtent,
  type ThreatBadge,
} from './badges.js';
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
import type { TextAnchor } from './labels.js';
import type { CanvasNode } from './layout.js';
import { controlPolygon } from './paths.js';
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
 * The run of text one node's glyph draws, in the node's own coordinates: a
 * text element's prose, a box boundary's name below its top edge, a curve
 * boundary's name beside its middle waypoint, and every other kind's name
 * centred in its box. A process wraps to the width of the square inscribed
 * in its circle rather than to its box.
 *
 * A curve's name hangs off the unit normal of the curve's own tangent at
 * that waypoint, a clearance plus the name's extent projected onto that
 * normal, so a curve dividing two lanes carries its name beside the dashes
 * rather than under them, whatever way it runs and however it bows. The
 * tangent is the drawn curve's, the run from the waypoint before to the one
 * after with the ends repeated where a neighbour is missing, which is the
 * tangent Catmull-Rom gives the cubic there. Of the two normals the one with
 * a non-negative y is the curve's own, and where that y is zero the one with
 * a positive x, the rule a flow's name follows, so the side is fixed by the
 * waypoints and not by the end the curve is drawn from.
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
    return curveNamePlacement(node.name, node.waypoints);
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

function curveNamePlacement(
  name: string,
  waypoints: readonly Point[],
): TextPlacement {
  const middle = Math.floor(waypoints.length / 2);
  return nameBeside(
    name,
    waypoints[middle],
    labelNormal(curveTangent(waypoints, middle)),
    flowLabelClearance,
    'label',
  );
}

function curveTangent(waypoints: readonly Point[], at: number): Segment {
  return {
    from: waypoints[Math.max(0, at - 1)],
    to: waypoints[Math.min(waypoints.length - 1, at + 1)],
  };
}

function boxCentre(size: Size): Point {
  return { x: size.width / 2, y: size.height / 2 };
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
 * standoffs a clearance apart. A candidate costs one for every element box,
 * element name and element badge its own name or badge box overlaps, one
 * for every straight run of a drawn line that meets either box, and one for
 * every name or badge already placed that either box overlaps. An element
 * the canvas draws as a box occupies its box, its run of text and its badge,
 * so a label over an element's name costs both; a trust boundary occupies
 * its outline alone, its four sides or the polygon its curve's control
 * points trace, since it encloses what it is drawn around and a label inside
 * it is where it belongs. The drawn lines are those outlines and every
 * flow's own polyline, and a flow's own line counts as much as another's,
 * which costs nothing at the standoff that put the label beside it and does
 * cost where the flow doubles back under its own name.
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
  const drawn = drawnObstacles(flows, nodes);
  const ordered = flows.map((flow, index) => ({ flow, index }));
  ordered.sort((one, other) => byIdAscending(one.flow, other.flow));
  const placed: Box[] = [];
  const placements: FlowLabelPlacement[] = [];
  for (const { flow, index } of ordered) {
    const chosen = cheapestCandidate(flow, drawn, placed);
    placements[index] = chosen.placement;
    placed.push(...chosen.boxes);
  }
  return placements;
}

type Candidate = {
  readonly placement: FlowLabelPlacement;
  readonly boxes: readonly Box[];
  readonly fromMiddle: number;
};

type Obstacles = {
  readonly boxes: readonly Box[];
  readonly lines: readonly Segment[];
};

function byIdAscending(one: FlowGeometry, other: FlowGeometry): number {
  if (one.id === other.id) {
    return 0;
  }
  return one.id < other.id ? -1 : 1;
}

function cheapestCandidate(
  flow: FlowGeometry,
  drawn: Obstacles,
  placed: readonly Box[],
): Candidate {
  const segments = segmentsOfPolyline(flow.points);
  const home = homeSegment(flow.points, segments);
  const middle = alongSegment(home, 0.5);
  let best = candidateAt(flow, home, 0.5, 0, 1, middle);
  let cost = collisionsOf(best, drawn, placed);
  for (const next of candidatesOf(flow, segments, middle)) {
    const held = collisionsOf(next, drawn, placed);
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
    boxes: [
      ...(nameBox === undefined ? [] : [nameBox]),
      ...(badge === undefined ? [] : [badge.box]),
    ],
    fromMiddle: Math.hypot(name.at.x - middle.x, name.at.y - middle.y),
  };
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

function collisionsOf(
  candidate: Candidate,
  drawn: Obstacles,
  placed: readonly Box[],
): number {
  let held = 0;
  for (const box of candidate.boxes) {
    held += drawn.boxes.filter((other) => boxesOverlap(box, other)).length;
    held += placed.filter((other) => boxesOverlap(box, other)).length;
    held += drawn.lines.filter((line) => segmentMeetsBox(line, box)).length;
  }
  return held;
}

function drawnObstacles(
  flows: readonly FlowGeometry[],
  nodes: readonly CanvasNode[],
): Obstacles {
  const boxes: Box[] = [];
  const lines: Segment[] = [];
  for (const node of nodes) {
    const own = nodeObstacles(node);
    boxes.push(...own.boxes);
    lines.push(...own.lines);
  }
  for (const flow of flows) {
    lines.push(...segmentsOfPolyline(flow.points));
  }
  return { boxes, lines };
}

function nodeObstacles(node: CanvasNode): Obstacles {
  const own = [...ownTextBox(node), ...ownBadgeBox(node)];
  const box = nodeBox(node);
  if (node.kind === 'boundary-box') {
    return { boxes: own, lines: segmentsOfBox(box) };
  }
  if (node.kind === 'boundary-curve') {
    return {
      boxes: own,
      lines: segmentsOfPolyline(
        controlPolygon(node.waypoints).map((point) =>
          shiftedBy(point, node.position),
        ),
      ),
    };
  }
  return { boxes: [box, ...own], lines: [] };
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
