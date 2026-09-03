import type { Point, Size } from '@panoptes/model';

/** The sides of a node, in the order a tie between them breaks. */
export const handleSides = ['top', 'right', 'bottom', 'left'] as const;

/** One side of a node, where a flow endpoint attaches. */
export type HandleSide = (typeof handleSides)[number];

/** Where a node sits and how large it is, the pair every handle comes from. */
export type NodeBox = {
  readonly position: Point;
  readonly size: Size;
};

/** Centre of a node's box. */
export function centreOf(box: NodeBox): Point {
  return {
    x: box.position.x + box.size.width / 2,
    y: box.position.y + box.size.height / 2,
  };
}

/**
 * A node's four handle positions, at the midpoints of its sides. Nothing is
 * measured: the positions are the model's own position and size.
 */
export function handlePositions(box: NodeBox): Record<HandleSide, Point> {
  const centre = centreOf(box);
  return {
    top: { x: centre.x, y: box.position.y },
    right: { x: box.position.x + box.size.width, y: centre.y },
    bottom: { x: centre.x, y: box.position.y + box.size.height },
    left: { x: box.position.x, y: centre.y },
  };
}

/**
 * The side whose midpoint lies nearest the given point. Ties break in the
 * order of {@link handleSides}: top, then right, then bottom, then left.
 */
export function nearestHandleSide(box: NodeBox, toward: Point): HandleSide {
  const positions = handlePositions(box);
  let nearest: HandleSide = handleSides[0];
  for (const side of handleSides) {
    if (
      squaredDistance(positions[side], toward) <
      squaredDistance(positions[nearest], toward)
    ) {
      nearest = side;
    }
  }
  return nearest;
}

function squaredDistance(from: Point, to: Point): number {
  return (from.x - to.x) ** 2 + (from.y - to.y) ** 2;
}
