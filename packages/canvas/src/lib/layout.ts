import type {
  Diagram,
  Element,
  ElementId,
  Flow,
  FlowEndpoint,
  Model,
  Point,
  Size,
  TrustBoundary,
} from '@panoptes/model';
import {
  badgeAnchor,
  badgeBox,
  badgesByElement,
  type ThreatBadge,
} from './badges.js';
import { cornersOfBox, shiftedBy } from './geometry.js';
import {
  flowLabelPlacements,
  nodeTextPlacement,
  settledCurveNames,
  textPlacementCorners,
  type CurveNameSide,
  type FlowGeometry,
  type FlowLabelPlacement,
} from './label-placement.js';
import {
  centreOf,
  handlePositions,
  nearestHandleSide,
  type HandleSide,
  type NodeBox,
} from './handles.js';
import { arrowheadPoints, controlPolygon } from './paths.js';
import { boundaryStrokeWidth } from './stylesheet.js';

type CanvasNodeBase = {
  readonly id: ElementId;
  readonly name: string;
  readonly outOfScope: boolean;
  readonly position: Point;
  readonly size: Size;
  readonly badge: ThreatBadge | undefined;
};

/**
 * One element laid out as a box: where React Flow places its node and where
 * the headless render translates its glyph. Every extent is the model's own,
 * except a boundary curve's, which carries no box: it takes the box its
 * waypoints span, grown by the stroke width on every side, so the drawn
 * stroke falls inside the node and a straight run or a pair of repeated
 * waypoints still has an extent to pick. Its waypoints are held again
 * relative to that box, so the glyph draws in the node's own coordinates,
 * and `nameSide` carries which bend of the curve, and which side of it,
 * {@link settledCurveNames} put its name on. A node is built without one,
 * which draws the convex side of the middle waypoint, the candidate the
 * settling tries first.
 */
export type CanvasNode =
  | (CanvasNodeBase & { readonly kind: 'actor' })
  | (CanvasNodeBase & { readonly kind: 'process' })
  | (CanvasNodeBase & { readonly kind: 'store' })
  | (CanvasNodeBase & { readonly kind: 'text'; readonly text: string })
  | (CanvasNodeBase & { readonly kind: 'boundary-box' })
  | (CanvasNodeBase & {
      readonly kind: 'boundary-curve';
      readonly waypoints: readonly Point[];
      readonly nameSide: CurveNameSide | undefined;
    });

/** What kind of box an element takes on the canvas. */
export type CanvasNodeKind = CanvasNode['kind'];

type CanvasEdgeGeometry = {
  readonly id: ElementId;
  readonly name: string;
  readonly outOfScope: boolean;
  readonly badge: ThreatBadge | undefined;
  readonly source: Point;
  readonly target: Point;
  readonly sourceSide: HandleSide | undefined;
  readonly targetSide: HandleSide | undefined;
  readonly sourceElement: ElementId | undefined;
  readonly targetElement: ElementId | undefined;
  readonly waypoints: readonly Point[];
};

/**
 * One flow laid out in the diagram's own coordinates: each end resolved to a
 * handle midpoint or to its own free position, the side an attached end
 * uses, and where its name and badge hang. `sourceElement` and
 * `targetElement` are absent for a free end, which belongs to no element.
 *
 * `label` is settled once, over the whole diagram, by
 * {@link flowLabelPlacements}, so the glyph that draws the name and the
 * bounds that hold it read one placement rather than each deriving its own.
 */
export type CanvasEdge = CanvasEdgeGeometry & {
  readonly label: FlowLabelPlacement;
};

/**
 * A flow endpoint the layout could not place, because it names an element
 * the canvas draws as no box. The model permits it: an endpoint takes any
 * element id, another flow's included. The flow it belongs to is left out of
 * the layout rather than given invented geometry.
 */
export type UnplacedEndpoint = {
  readonly flow: ElementId;
  readonly side: 'source' | 'target';
  readonly element: ElementId;
};

/**
 * The smallest box holding the ink a diagram lays down: node outlines, a
 * boundary curve's cubics, the text inside and beside them, the badges
 * hanging off them, the flow lines with their arrowheads and names, and a
 * free end that belongs to no node. Every part is measured with the function
 * that draws that part, so the picture and the box around it cannot drift.
 * A curve is bounded by the convex hull of the control points
 * {@link controlPolygon} traces, which holds the curve and a little more,
 * since a sharp turn throws a control point outside the box the waypoints
 * span while the ink stays inside the hull.
 *
 * Stroke widths are the one thing outside it, since a stroke straddles the
 * line it paints, so a caller sizing a viewBox leaves whitespace for them.
 * It leaves nothing else: this is ink rather than geometry, and padding it
 * again for badges or labels pads what is already counted.
 */
export type CanvasBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * A diagram ready to draw: the boundaries first, so they sit behind what
 * they enclose, then the remaining nodes in diagram order, then the flows.
 * Painting `nodes` and then `edges` gives that order, since a flow ends on
 * the outline of the node it points at rather than under it. `bounds` holds
 * everything that painting draws, on the terms of {@link CanvasBounds}.
 */
export type CanvasLayout = {
  readonly nodes: readonly CanvasNode[];
  readonly edges: readonly CanvasEdge[];
  readonly unplaced: readonly UnplacedEndpoint[];
  readonly bounds: CanvasBounds;
};

/**
 * One diagram of the model laid out. Every position and extent comes from
 * the model; nothing is measured. Badges are read from the whole model,
 * since a threat names elements without naming a diagram.
 */
export function layoutDiagram(diagram: Diagram, model: Model): CanvasLayout {
  const badges = badgesByElement(model);
  const nodes = diagram.elements.flatMap((element) => nodesOf(element, badges));
  const boxes = new Map<ElementId, NodeBox>(
    nodes.map((node) => [
      node.id,
      { position: node.position, size: node.size },
    ]),
  );
  const placed = diagram.elements.flatMap((element) =>
    element.kind === 'flow' ? [placeFlow(element, boxes, badges)] : [],
  );
  const ordered = settledCurveNames([
    ...nodes.filter((node) => isBoundary(node)),
    ...nodes.filter((node) => !isBoundary(node)),
  ]);
  const drawn = placed.flatMap((flow) =>
    flow.edge === undefined ? [] : [flow.edge],
  );
  const labels = flowLabelPlacements(drawn.map(flowGeometry), ordered);
  const edges = drawn.map((edge, index) => ({ ...edge, label: labels[index] }));
  return {
    nodes: ordered,
    edges,
    unplaced: placed.flatMap((flow) => flow.unplaced),
    bounds: boundsOf(ordered, edges),
  };
}

/**
 * One laid-out flow with its two ends resolved again, against boxes a caller
 * holds more recently than the model does. The interactive canvas passes
 * where React Flow has each end's node while a gesture is in flight, so the
 * line follows the element under the pointer rather than waiting for the
 * drop. A box is absent for an end the layout left free and for one the
 * caller cannot resolve, and such an end keeps the anchor and the side the
 * layout settled. Nothing here reads what kind of element a box belongs to,
 * so a flow attached to a trust boundary follows it as it follows any other
 * node, and a free end is carried by no box at all, the model linking an
 * element to a boundary by nothing but where the two are drawn.
 *
 * Only the two anchors move. The name and the badge keep the placement
 * {@link layoutDiagram} settled over the whole diagram, which is the work
 * this does not repeat: a flow costs a handful of arithmetic here rather than
 * a placement pass over every flow in the diagram. That arithmetic is the
 * layout's own, so a box back where the model has it gives the settled anchor
 * exactly and a drop moves no line.
 */
export function reanchoredFlow(
  edge: CanvasEdge,
  sourceBox: NodeBox | undefined,
  targetBox: NodeBox | undefined,
): CanvasEdge {
  const source = endpointAt(sourceBox, edge.source, edge.sourceElement);
  const target = endpointAt(targetBox, edge.target, edge.targetElement);
  const sourceAnchor = anchorOf(
    source,
    edge.waypoints[0] ?? referenceOf(target),
  );
  const targetAnchor = anchorOf(
    target,
    edge.waypoints.at(-1) ?? referenceOf(source),
  );
  return {
    ...edge,
    source: sourceAnchor.point,
    target: targetAnchor.point,
    sourceSide: sourceAnchor.side ?? edge.sourceSide,
    targetSide: targetAnchor.side ?? edge.targetSide,
  };
}

type PlacedEndpoint =
  | { readonly kind: 'free'; readonly point: Point }
  | {
      readonly kind: 'node';
      readonly element: ElementId;
      readonly box: NodeBox;
    };

type ResolvedEndpoint =
  | PlacedEndpoint
  | { readonly kind: 'unplaced'; readonly element: ElementId };

type Anchor = {
  readonly point: Point;
  readonly side: HandleSide | undefined;
  readonly element: ElementId | undefined;
};

type PlacedFlow = {
  readonly edge: CanvasEdgeGeometry | undefined;
  readonly unplaced: readonly UnplacedEndpoint[];
};

function flowGeometry(edge: CanvasEdgeGeometry): FlowGeometry {
  return {
    id: edge.id,
    name: edge.name,
    badge: edge.badge,
    points: edgePoints(edge),
  };
}

function edgePoints(edge: CanvasEdgeGeometry): readonly [Point, ...Point[]] {
  return [edge.source, ...edge.waypoints, edge.target];
}

function isBoundary(node: CanvasNode): boolean {
  return node.kind === 'boundary-box' || node.kind === 'boundary-curve';
}

function nodesOf(
  element: Element,
  badges: ReadonlyMap<ElementId, ThreatBadge>,
): CanvasNode[] {
  const badge = badges.get(element.id);
  if (element.kind === 'flow') {
    return [];
  }
  if (element.kind === 'trust-boundary') {
    return [boundaryNode(element, badge)];
  }
  const base = {
    id: element.id,
    name: element.name,
    outOfScope: element.outOfScope,
    position: element.position,
    size: element.size,
    badge,
  };
  if (element.kind === 'text') {
    return [{ ...base, kind: 'text', text: element.text }];
  }
  return [{ ...base, kind: element.kind }];
}

function boundaryNode(
  element: TrustBoundary,
  badge: ThreatBadge | undefined,
): CanvasNode {
  const base = {
    id: element.id,
    name: element.name,
    outOfScope: element.outOfScope,
    badge,
  };
  if (element.shape.kind === 'curve') {
    const box = boundsOfPoints(element.shape.waypoints);
    const origin = {
      x: box.x - boundaryStrokeWidth,
      y: box.y - boundaryStrokeWidth,
    };
    return {
      ...base,
      kind: 'boundary-curve',
      nameSide: undefined,
      position: origin,
      size: {
        width: box.width + boundaryStrokeWidth * 2,
        height: box.height + boundaryStrokeWidth * 2,
      },
      waypoints: element.shape.waypoints.map((point) => ({
        x: point.x - origin.x,
        y: point.y - origin.y,
      })),
    };
  }
  return {
    ...base,
    kind: 'boundary-box',
    position: element.shape.position,
    size: element.shape.size,
  };
}

function placeFlow(
  flow: Flow,
  boxes: ReadonlyMap<ElementId, NodeBox>,
  badges: ReadonlyMap<ElementId, ThreatBadge>,
): PlacedFlow {
  const source = resolveEndpoint(flow.source, boxes);
  const target = resolveEndpoint(flow.target, boxes);
  const unplaced = [
    ...unplacedOf(flow, 'source', source),
    ...unplacedOf(flow, 'target', target),
  ];
  if (source.kind === 'unplaced' || target.kind === 'unplaced') {
    return { edge: undefined, unplaced };
  }
  const sourceAnchor = anchorOf(
    source,
    flow.waypoints[0] ?? referenceOf(target),
  );
  const targetAnchor = anchorOf(
    target,
    flow.waypoints.at(-1) ?? referenceOf(source),
  );
  return {
    edge: {
      id: flow.id,
      name: flow.name,
      outOfScope: flow.outOfScope,
      badge: badges.get(flow.id),
      source: sourceAnchor.point,
      target: targetAnchor.point,
      sourceSide: sourceAnchor.side,
      targetSide: targetAnchor.side,
      sourceElement: sourceAnchor.element,
      targetElement: targetAnchor.element,
      waypoints: flow.waypoints,
    },
    unplaced,
  };
}

function resolveEndpoint(
  endpoint: FlowEndpoint,
  boxes: ReadonlyMap<ElementId, NodeBox>,
): ResolvedEndpoint {
  if (endpoint.kind === 'free') {
    return { kind: 'free', point: endpoint.position };
  }
  const box = boxes.get(endpoint.element);
  return box === undefined
    ? { kind: 'unplaced', element: endpoint.element }
    : { kind: 'node', element: endpoint.element, box };
}

function endpointAt(
  box: NodeBox | undefined,
  settled: Point,
  element: ElementId | undefined,
): PlacedEndpoint {
  return box === undefined || element === undefined
    ? { kind: 'free', point: settled }
    : { kind: 'node', element, box };
}

function unplacedOf(
  flow: Flow,
  side: 'source' | 'target',
  resolved: ResolvedEndpoint,
): UnplacedEndpoint[] {
  return resolved.kind === 'unplaced'
    ? [{ flow: flow.id, side, element: resolved.element }]
    : [];
}

function referenceOf(endpoint: PlacedEndpoint): Point {
  return endpoint.kind === 'free' ? endpoint.point : centreOf(endpoint.box);
}

function anchorOf(endpoint: PlacedEndpoint, toward: Point): Anchor {
  if (endpoint.kind === 'free') {
    return { point: endpoint.point, side: undefined, element: undefined };
  }
  const side = nearestHandleSide(endpoint.box, toward);
  return {
    point: handlePositions(endpoint.box)[side],
    side,
    element: endpoint.element,
  };
}

function boundsOf(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
): CanvasBounds {
  return boundsOfPoints([
    ...nodes.flatMap((node) => drawnNodePoints(node)),
    ...edges.flatMap((edge) => drawnEdgePoints(edge)),
  ]);
}

function drawnNodePoints(node: CanvasNode): Point[] {
  return [
    node.position,
    {
      x: node.position.x + node.size.width,
      y: node.position.y + node.size.height,
    },
    ...textPlacementCorners(nodeTextPlacement(node)).map((corner) =>
      shiftedBy(corner, node.position),
    ),
    ...outlinePoints(node).map((point) => shiftedBy(point, node.position)),
    ...badgePoints(
      shiftedBy(badgeAnchor(node.size), node.position),
      node.badge,
    ),
  ];
}

function outlinePoints(node: CanvasNode): Point[] {
  if (node.kind !== 'boundary-curve') {
    return [];
  }
  return [...controlPolygon(node.waypoints)];
}

function drawnEdgePoints(edge: CanvasEdge): Point[] {
  const points = edgePoints(edge);
  return [
    ...points,
    ...arrowheadPoints(edge.target, points[points.length - 2]),
    ...textPlacementCorners(edge.label.name),
    ...(edge.label.badge === undefined
      ? []
      : badgePoints(edge.label.badge, edge.badge)),
  ];
}

function badgePoints(at: Point, badge: ThreatBadge | undefined): Point[] {
  return badge === undefined ? [] : cornersOfBox(badgeBox(at, badge));
}

function boundsOfPoints(points: readonly Point[]): CanvasBounds {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
