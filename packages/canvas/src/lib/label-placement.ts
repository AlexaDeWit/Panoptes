import type { Point, Size } from '@panoptes/model';
import { badgeExtent, type ThreatBadge } from './badges.js';
import type { TextAnchor } from './labels.js';
import type { CanvasNode } from './layout.js';
import { wrappedTextStyles, type WrappedTextStyle } from './stylesheet.js';
import {
  flowLabelClearance,
  innerWidth,
  lineHeight,
  looseLabelWidth,
  textExtent,
  textPadding,
  wrapText,
  type TextExtent,
} from './typography.js';

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
 * boundary's name a line above its middle waypoint, and every other kind's
 * name centred in its box. A process wraps to the width of the square
 * inscribed in its circle rather than to its box.
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
    const middle = node.waypoints[Math.floor(node.waypoints.length / 2)];
    return {
      text: node.name,
      at: {
        x: middle.x,
        y: middle.y - lineHeight(wrappedTextStyles.label.fontSize),
      },
      anchor: 'centre',
      width: looseLabelWidth,
      textStyle: 'label',
    };
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

/**
 * Where a flow's name and badge hang. `badge` is absent for a flow no open
 * threat names.
 */
export type FlowLabelPlacement = {
  readonly name: TextPlacement;
  readonly badge: Point | undefined;
};

/**
 * Where a flow's name and badge sit, from the flow's own points and nothing
 * measured. Both hang off the midpoint of the longest segment, offset along
 * that segment's own unit normal rather than down the y axis, by
 * {@link flowLabelClearance} plus their own extent projected onto that
 * normal, so a vertical or diagonal flow carries its name beside its line
 * instead of along it. The name takes the normal whose y is non-negative,
 * or where that y is zero the one whose x is positive, and the badge takes
 * the other, so the side each lands on is fixed by the segment rather than
 * by which end the flow runs from.
 *
 * The glyph that draws them and a caller sizing a picture around them both
 * come here, so what is drawn and what is bounded cannot part.
 */
export function flowLabelPlacement(
  points: readonly Point[],
  name: string,
  badge: ThreatBadge | undefined,
): FlowLabelPlacement {
  const segment = longestSegment(points);
  const midpoint = midpointOf(segment);
  const normal = labelNormal(segment);
  const fontSize = wrappedTextStyles.flowLabel.fontSize;
  const extent = textExtent(
    wrapText(name, fontSize, looseLabelWidth),
    fontSize,
  );
  return {
    name: {
      text: name,
      at: offsetBy(
        midpoint,
        normal,
        flowLabelClearance + projectedHalfExtent(extent, normal),
      ),
      anchor: 'centre',
      width: looseLabelWidth,
      textStyle: 'flowLabel',
    },
    badge:
      badge === undefined
        ? undefined
        : offsetBy(
            midpoint,
            negated(normal),
            flowLabelClearance + badgeReach(badge, normal),
          ),
  };
}

type Segment = { readonly from: Point; readonly to: Point };

function boxCentre(size: Size): Point {
  return { x: size.width / 2, y: size.height / 2 };
}

function longestSegment(points: readonly Point[]): Segment {
  let longest = 0;
  let at = 0;
  for (let index = 0; index + 1 < points.length; index += 1) {
    const run =
      (points[index + 1].x - points[index].x) ** 2 +
      (points[index + 1].y - points[index].y) ** 2;
    if (run > longest) {
      longest = run;
      at = index;
    }
  }
  return { from: points[at], to: points[at + 1] };
}

function midpointOf(segment: Segment): Point {
  return {
    x: (segment.from.x + segment.to.x) / 2,
    y: (segment.from.y + segment.to.y) / 2,
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
  return { x: -point.x, y: -point.y };
}

function offsetBy(at: Point, direction: Point, distance: number): Point {
  return {
    x: at.x + direction.x * distance,
    y: at.y + direction.y * distance,
  };
}

function projectedHalfExtent(extent: TextExtent, normal: Point): number {
  return (
    (extent.width / 2) * Math.abs(normal.x) +
    (extent.height / 2) * Math.abs(normal.y)
  );
}

function badgeReach(badge: ThreatBadge, normal: Point): number {
  const extent = badgeExtent(badge);
  return extent.radius * Math.abs(normal.x) + extent.depth * normal.y;
}
