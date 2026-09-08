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
} from '@saerskriven/model';
import {
  badgeAnchor,
  badgeBox,
  badgesByElement,
  type ThreatBadge,
} from './badges.js';
import { cornersOfBox, shiftedBy } from './geometry.js';
import {
  flowLabelPlacements,
  flowLabelPlacementsDuringMove,
  movedFlowLabel,
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

/** A node's measured box. Boundary curves use local waypoints and include stroke padding in their extent. */
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

/** A flow with resolved endpoints and label placement shared by drawing and bounds calculations. */
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

/** The extent of nodes, flows, labels, and badges. Curves use their control hull. Callers add padding for stroke widths. */
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
    bounds: drawnBounds(ordered, edges),
  };
}

/**
 * Lays out flows against boxes that are moving in the interactive canvas.
 * A selected flow moves its waypoints and free ends by the group offset.
 * An interactive frame can retain static labels while it places moving ones.
 */
export function layoutDuringMove(
  layout: CanvasLayout,
  boxes: ReadonlyMap<ElementId, NodeBox>,
  moving: ReadonlySet<ElementId>,
  offset: Point,
  exactLabels = true,
  labelBases: ReadonlyMap<string, CanvasEdge> = new Map(),
): CanvasLayout {
  const changedNodes = new Set<ElementId>();
  const nodes = layout.nodes.map((node) => {
    const box = boxes.get(node.id);
    if (
      box === undefined ||
      (box.position.x === node.position.x &&
        box.position.y === node.position.y &&
        box.size.width === node.size.width &&
        box.size.height === node.size.height)
    ) {
      return node;
    }
    changedNodes.add(node.id);
    return { ...node, position: box.position, size: box.size };
  });
  const movingFlows = new Set(
    layout.edges.flatMap((edge) =>
      (moving.has(edge.id) && (offset.x !== 0 || offset.y !== 0)) ||
      (edge.sourceElement !== undefined &&
        changedNodes.has(edge.sourceElement)) ||
      (edge.targetElement !== undefined && changedNodes.has(edge.targetElement))
        ? [edge.id]
        : [],
    ),
  );
  const geometry = layout.edges.map((edge) => {
    if (!movingFlows.has(edge.id)) {
      return edge;
    }
    const shifted = moving.has(edge.id) ? shiftedFlow(edge, offset) : edge;
    return reanchoredGeometry(
      shifted,
      shifted.sourceElement === undefined
        ? undefined
        : boxes.get(shifted.sourceElement),
      shifted.targetElement === undefined
        ? undefined
        : boxes.get(shifted.targetElement),
    );
  });
  const flowGeometryByEdge = geometry.map(flowGeometry);
  const retainedLabels = new Map(
    geometry.map((edge, index) => {
      const settled = layout.edges[index];
      const base = labelBases.get(edge.id) ?? settled;
      return [
        edge.id,
        edge === base
          ? base.label
          : movedFlowLabel(
              base.label,
              base.badge,
              edgePoints(base),
              edgePoints(edge),
            ),
      ];
    }),
  );
  const labelsToPlace = new Set(
    geometry.flatMap((edge, index) =>
      movingFlows.has(edge.id) &&
      !moving.has(edge.id) &&
      !flowIsTranslation(layout.edges[index], edge)
        ? [edge.id]
        : [],
    ),
  );
  const labels = exactLabels
    ? flowLabelPlacements(flowGeometryByEdge, nodes)
    : flowLabelPlacementsDuringMove(
        flowGeometryByEdge,
        nodes,
        retainedLabels,
        labelsToPlace,
      );
  const edges = geometry.map((edge, index) => {
    const settled = layout.edges[index];
    return edge === settled && sameFlowLabel(labels[index], settled.label)
      ? settled
      : { ...edge, label: labels[index] };
  });
  return {
    nodes,
    edges,
    unplaced: layout.unplaced,
    bounds: layout.bounds,
  };
}

const layoutCoordinateTolerance = 1e-6;

function sameCoordinate(one: number, other: number): boolean {
  return Math.abs(one - other) <= layoutCoordinateTolerance;
}

function flowIsTranslation(
  from: CanvasEdgeGeometry,
  to: CanvasEdgeGeometry,
): boolean {
  const oldPoints = edgePoints(from);
  const newPoints = edgePoints(to);
  const offset = {
    x: newPoints[0].x - oldPoints[0].x,
    y: newPoints[0].y - oldPoints[0].y,
  };
  return oldPoints.every((point, index) => {
    const moved = newPoints[index];
    return (
      sameCoordinate(moved.x, point.x + offset.x) &&
      sameCoordinate(moved.y, point.y + offset.y)
    );
  });
}

function sameFlowLabel(
  one: FlowLabelPlacement,
  other: FlowLabelPlacement,
): boolean {
  return (
    one.name.text === other.name.text &&
    sameCoordinate(one.name.at.x, other.name.at.x) &&
    sameCoordinate(one.name.at.y, other.name.at.y) &&
    one.name.anchor === other.name.anchor &&
    one.name.width === other.name.width &&
    one.name.textStyle === other.name.textStyle &&
    ((one.badge === undefined && other.badge === undefined) ||
      (one.badge !== undefined &&
        other.badge !== undefined &&
        sameCoordinate(one.badge.x, other.badge.x) &&
        sameCoordinate(one.badge.y, other.badge.y)))
  );
}

/** Whether `to` keeps the label candidate that `from` used on its old path. */
export function flowLabelFollows(from: CanvasEdge, to: CanvasEdge): boolean {
  return sameFlowLabel(flowWithFollowedLabel(from, to).label, to.label);
}

/** The new flow geometry with its prior label candidate moved onto it. */
export function flowWithFollowedLabel(
  from: CanvasEdge,
  to: CanvasEdge,
): CanvasEdge {
  return {
    ...to,
    label: movedFlowLabel(
      from.label,
      from.badge,
      edgePoints(from),
      edgePoints(to),
    ),
  };
}

/** Reanchors endpoints during movement. Free endpoints retain their anchors. Labels and badges follow their prior segment without a diagram-wide collision search. */
export function reanchoredFlow(
  edge: CanvasEdge,
  sourceBox: NodeBox | undefined,
  targetBox: NodeBox | undefined,
  flowOffset: Point = { x: 0, y: 0 },
): CanvasEdge {
  const shifted =
    flowOffset.x === 0 && flowOffset.y === 0
      ? edge
      : shiftedFlow(edge, flowOffset);
  const anchored = reanchoredGeometry(shifted, sourceBox, targetBox);
  return {
    ...anchored,
    label: movedFlowLabel(
      shifted.label,
      shifted.badge,
      edgePoints(shifted),
      edgePoints(anchored),
    ),
  };
}

function reanchoredGeometry(
  edge: CanvasEdgeGeometry,
  sourceBox: NodeBox | undefined,
  targetBox: NodeBox | undefined,
): CanvasEdgeGeometry {
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

function shiftedFlow(edge: CanvasEdge, offset: Point): CanvasEdge {
  return {
    ...edge,
    source:
      edge.sourceElement === undefined
        ? shiftedBy(edge.source, offset)
        : edge.source,
    target:
      edge.targetElement === undefined
        ? shiftedBy(edge.target, offset)
        : edge.target,
    waypoints: edge.waypoints.map((point) => shiftedBy(point, offset)),
    label: {
      name: {
        ...edge.label.name,
        at: shiftedBy(edge.label.name.at, offset),
      },
      badge:
        edge.label.badge === undefined
          ? undefined
          : shiftedBy(edge.label.badge, offset),
    },
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

const flowGeometries = new WeakMap<CanvasEdgeGeometry, FlowGeometry>();

function flowGeometry(edge: CanvasEdgeGeometry): FlowGeometry {
  const cached = flowGeometries.get(edge);
  if (cached !== undefined) {
    return cached;
  }
  const geometry = {
    id: edge.id,
    name: edge.name,
    badge: edge.badge,
    points: edgePoints(edge),
  };
  flowGeometries.set(edge, geometry);
  return geometry;
}

function edgePoints(edge: CanvasEdgeGeometry): readonly [Point, ...Point[]] {
  return [edge.source, ...edge.waypoints, edge.target];
}

/** A laid-out trust boundary. */
export type CanvasBoundaryNode = Extract<
  CanvasNode,
  { readonly kind: 'boundary-box' | 'boundary-curve' }
>;

/** Whether a laid-out node is a trust boundary. */
export function isBoundary(node: CanvasNode): node is CanvasBoundaryNode {
  return node.kind === 'boundary-box' || node.kind === 'boundary-curve';
}

function nodesOf(
  element: Element,
  badges: ReadonlyMap<ElementId, ThreatBadge>,
): CanvasNode[] {
  const node = canvasNodeOf(element, badges.get(element.id));
  return node === undefined ? [] : [node];
}

/** Converts one model element into the node the canvas draws. */
export function canvasNodeOf(
  element: Element,
  badge?: ThreatBadge,
): CanvasNode | undefined {
  if (element.kind === 'flow') {
    return undefined;
  }
  if (element.kind === 'trust-boundary') {
    return boundaryNode(element, badge);
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
    return { ...base, kind: 'text', text: element.text };
  }
  return { ...base, kind: element.kind };
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

/** The full drawn extent of the given nodes and flows, including labels and badges. */
export function drawnBounds(
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
