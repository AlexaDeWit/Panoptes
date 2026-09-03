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

/**
 * A smooth open curve through the given points, as cubic segments. The
 * control points are Catmull-Rom's, with the run's own ends repeated where
 * a neighbour is missing, so the path is a function of the waypoints and of
 * nothing else. Fewer than two points leave nothing to smooth and come back
 * as {@link polylinePath}.
 */
export function smoothPath(points: readonly Point[]): string {
  if (points.length < 2) {
    return polylinePath(points);
  }
  const start = points[0];
  const segments = points
    .slice(0, -1)
    .map((from, index) =>
      cubicSegment(
        points[Math.max(0, index - 1)],
        from,
        points[index + 1],
        points[Math.min(points.length - 1, index + 2)],
      ),
    );
  return [`M ${svgNumber(start.x)} ${svgNumber(start.y)}`, ...segments].join(
    ' ',
  );
}

/**
 * The filled triangle that marks where a flow ends: its tip at `tip`,
 * pointing away from `from`. A segment of no length points to the right, so
 * the marker is drawn whatever geometry the model carries.
 */
export function arrowheadPath(tip: Point, from: Point): string {
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
  const outline = polylinePath([
    tip,
    { x: base.x + wing.x, y: base.y + wing.y },
    { x: base.x - wing.x, y: base.y - wing.y },
  ]);
  return `${outline} Z`;
}

function cubicSegment(
  before: Point,
  start: Point,
  end: Point,
  after: Point,
): string {
  const first = {
    x: start.x + (end.x - before.x) / 6,
    y: start.y + (end.y - before.y) / 6,
  };
  const second = {
    x: end.x - (after.x - start.x) / 6,
    y: end.y - (after.y - start.y) / 6,
  };
  return `C ${svgNumber(first.x)} ${svgNumber(first.y)} ${svgNumber(
    second.x,
  )} ${svgNumber(second.y)} ${svgNumber(end.x)} ${svgNumber(end.y)}`;
}
