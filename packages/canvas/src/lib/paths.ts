import type { Point } from '@panoptes/model';
import { svgNumber } from './numbers.js';

const arrowheadLength = 12;

const arrowheadHalfWidth = 5;

/** The given point as an SVG `transform` that moves an element to it. */
export function translate(point: Point): string {
  return `translate(${svgNumber(point.x)}, ${svgNumber(point.y)})`;
}

/** Straight segments through the given points, as an SVG path. */
export function polylinePath(points: readonly Point[]): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${svgNumber(point.x)} ${svgNumber(point.y)}`,
    )
    .join(' ');
}

/** One cubic segment of a smooth curve: its two control points and its end. */
export type CubicSegment = {
  readonly firstControl: Point;
  readonly secondControl: Point;
  readonly end: Point;
};

/**
 * The cubic segments {@link smoothPath} draws a curve through the given
 * points as. The control points are Catmull-Rom's, with the run's own ends
 * repeated where a neighbour is missing, so the curve is a function of the
 * points and of nothing else. Fewer than two points leave nothing to smooth
 * and come back as no segments.
 *
 * A caller bounding the drawn curve takes these rather than the points
 * alone. A cubic lies inside the convex hull of its own four control points,
 * and a sharp turn throws those outside the box the points span, so the
 * points alone bound the curve too tightly and the hull bounds it a little
 * loosely.
 */
export function smoothSegments(points: readonly Point[]): CubicSegment[] {
  if (points.length < 2) {
    return [];
  }
  return points
    .slice(0, -1)
    .map((from, index) =>
      cubicSegment(
        points[Math.max(0, index - 1)],
        from,
        points[index + 1],
        points[Math.min(points.length - 1, index + 2)],
      ),
    );
}

/**
 * A smooth open curve through the given points, as the cubic segments
 * {@link smoothSegments} resolves. Fewer than two points leave nothing to
 * smooth and come back as {@link polylinePath}.
 */
export function smoothPath(points: readonly Point[]): string {
  const drawn = smoothSegments(points).map(
    (segment) =>
      `C ${svgNumber(segment.firstControl.x)} ${svgNumber(
        segment.firstControl.y,
      )} ${svgNumber(segment.secondControl.x)} ${svgNumber(
        segment.secondControl.y,
      )} ${svgNumber(segment.end.x)} ${svgNumber(segment.end.y)}`,
  );
  if (drawn.length === 0) {
    return polylinePath(points);
  }
  const start = points[0];
  return [`M ${svgNumber(start.x)} ${svgNumber(start.y)}`, ...drawn].join(' ');
}

/**
 * The three corners of the triangle that marks where a flow ends: its tip at
 * `tip`, pointing away from `from`. A segment of no length points to the
 * right, so the marker has corners whatever geometry the model carries.
 * A caller sizing a picture bounds these rather than the tip alone, since
 * the wings reach across the line the flow arrives on.
 */
export function arrowheadPoints(tip: Point, from: Point): readonly Point[] {
  const run = { x: tip.x - from.x, y: tip.y - from.y };
  const length = Math.hypot(run.x, run.y);
  const unit =
    length === 0 ? { x: 1, y: 0 } : { x: run.x / length, y: run.y / length };
  const base = {
    x: tip.x - unit.x * arrowheadLength,
    y: tip.y - unit.y * arrowheadLength,
  };
  const wing = {
    x: -unit.y * arrowheadHalfWidth,
    y: unit.x * arrowheadHalfWidth,
  };
  return [
    tip,
    { x: base.x + wing.x, y: base.y + wing.y },
    { x: base.x - wing.x, y: base.y - wing.y },
  ];
}

/** {@link arrowheadPoints} closed, as a filled SVG path. */
export function arrowheadPath(tip: Point, from: Point): string {
  return `${polylinePath(arrowheadPoints(tip, from))} Z`;
}

function cubicSegment(
  before: Point,
  start: Point,
  end: Point,
  after: Point,
): CubicSegment {
  return {
    firstControl: {
      x: start.x + (end.x - before.x) / 6,
      y: start.y + (end.y - before.y) / 6,
    },
    secondControl: {
      x: end.x - (after.x - start.x) / 6,
      y: end.y - (after.y - start.y) / 6,
    },
    end,
  };
}
