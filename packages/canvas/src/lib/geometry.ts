import type { Point } from '@saerskriven/model';

/** An axis-aligned box, as the low and high bound on each axis. */
export type Box = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

/** A circle, as the point it is centred on and its radius. */
export type Circle = {
  readonly centre: Point;
  readonly radius: number;
};

/** A straight run between two points, the piece every drawn line is made of. */
export type Segment = {
  readonly from: Point;
  readonly to: Point;
};

/**
 * The smallest box holding the given points, or nothing where there are
 * none, which is what a run of text wrapping to no line at all gives.
 */
export function boxOfPoints(points: readonly Point[]): Box | undefined {
  if (points.length === 0) {
    return undefined;
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/** The straight runs between the given points, in the order they are given. */
export function segmentsOfPolyline(points: readonly Point[]): Segment[] {
  return points
    .slice(0, -1)
    .map((from, index) => ({ from, to: points[index + 1] }));
}

/** The four sides of a box, as straight runs from its top-left corner. */
export function segmentsOfBox(box: Box): Segment[] {
  return segmentsOfPolyline([
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
    { x: box.minX, y: box.minY },
  ]);
}

/** The four corners of a box, from its top-left corner clockwise. */
export function cornersOfBox(box: Box): Point[] {
  return [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];
}

/** The given point moved by the given offset. */
export function shiftedBy(point: Point, offset: Point): Point {
  return { x: point.x + offset.x, y: point.y + offset.y };
}

/** Whether two boxes share any area, an edge or a corner. */
export function boxesOverlap(one: Box, other: Box): boolean {
  return (
    one.minX <= other.maxX &&
    other.minX <= one.maxX &&
    one.minY <= other.maxY &&
    other.minY <= one.maxY
  );
}

/**
 * Whether a box shares any point with a circle, its edge and the circle's
 * own included. The point of the box nearest the centre decides it, which is
 * the centre itself where the centre lies inside.
 */
export function boxMeetsCircle(box: Box, circle: Circle): boolean {
  const nearestX = Math.min(Math.max(circle.centre.x, box.minX), box.maxX);
  const nearestY = Math.min(Math.max(circle.centre.y, box.minY), box.maxY);
  return (
    Math.hypot(nearestX - circle.centre.x, nearestY - circle.centre.y) <=
    circle.radius
  );
}

/**
 * Whether a straight run touches a box: it crosses, ends inside, or lies
 * along it. The three axes that can separate the pair are tested, the box's
 * two and the run's own normal, so a diagonal passing outside a corner reads
 * as clear. A run of no length is the point it stands at.
 */
export function segmentMeetsBox(segment: Segment, box: Box): boolean {
  if (
    Math.min(segment.from.x, segment.to.x) > box.maxX ||
    Math.max(segment.from.x, segment.to.x) < box.minX ||
    Math.min(segment.from.y, segment.to.y) > box.maxY ||
    Math.max(segment.from.y, segment.to.y) < box.minY
  ) {
    return false;
  }
  const normalX = segment.from.y - segment.to.y;
  const normalY = segment.to.x - segment.from.x;
  const at = (x: number, y: number): number =>
    normalX * (x - segment.from.x) + normalY * (y - segment.from.y);
  const topLeft = at(box.minX, box.minY);
  const topRight = at(box.maxX, box.minY);
  const bottomRight = at(box.maxX, box.maxY);
  const bottomLeft = at(box.minX, box.maxY);
  return (
    Math.min(topLeft, topRight, bottomRight, bottomLeft) <= 0 &&
    Math.max(topLeft, topRight, bottomRight, bottomLeft) >= 0
  );
}
