import type { ElementId } from '@panoptes/model';
import {
  Handle,
  Position,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import type { ReactElement } from 'react';
import { ElementGlyph, FlowGlyph } from './glyphs.js';
import { handleSides, type HandleSide } from './handles.js';
import type {
  CanvasEdge,
  CanvasLayout,
  CanvasNode,
  CanvasNodeKind,
} from './layout.js';
import { svgNumber } from './numbers.js';

const anchorExtent = 1;

const handlePlacement = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
} as const satisfies Record<HandleSide, Position>;

/** What a React Flow node of a Panoptes diagram carries: the laid-out node. */
export type CanvasNodeData = { readonly node: CanvasNode };

/** One React Flow node of a Panoptes diagram. */
export type CanvasFlowNode = Node<CanvasNodeData, CanvasNodeKind>;

/** What a React Flow edge of a Panoptes diagram carries: the laid-out flow. */
export type CanvasEdgeData = { readonly edge: CanvasEdge };

/** One React Flow edge of a Panoptes diagram. */
export type CanvasFlowEdge = Edge<CanvasEdgeData, 'flow'>;

/** The React Flow node type of the anchor a flow's free end rides on. */
export const freeEndNodeKind = 'free-end';

/** Which end of a flow an anchor stands for. */
export type FlowEndSide = 'source' | 'target';

/** What a free-end anchor carries: nothing, since it draws nothing. */
export type CanvasFreeEndData = Record<string, never>;

/** One React Flow node standing in for a flow's free end. */
export type CanvasFreeEndNode = Node<CanvasFreeEndData, typeof freeEndNodeKind>;

/**
 * One element as a React Flow node: the shared glyph at the model's own
 * width and height, and a handle at each side midpoint. Every handle is of
 * type `source`, so the canvas that mounts these passes
 * `connectionMode={ConnectionMode.Loose}` for a flow to be able to end on
 * one. The wrapper adds nothing of its own to the drawing, and the drawing
 * is hidden from assistive technology: the node's accessible name says what
 * the glyph shows, and the canvas mounting it settles that name.
 */
export function CanvasNodeBody({
  data,
}: NodeProps<CanvasFlowNode>): ReactElement {
  return (
    <>
      <svg
        width={svgNumber(data.node.size.width)}
        height={svgNumber(data.node.size.height)}
        overflow="visible"
        aria-hidden="true"
      >
        <ElementGlyph node={data.node} />
      </svg>
      {handleSides.map((side) => (
        <Handle
          key={side}
          id={side}
          type="source"
          position={handlePlacement[side]}
        />
      ))}
    </>
  );
}

/**
 * One flow as a React Flow edge, drawn from the geometry the layout resolved
 * out of the model rather than from the `sourceX`, `sourceY`, `targetX` and
 * `targetY` React Flow measures, so the interactive and headless paths
 * cannot part. The consequence is that dragging a node moves no flow on its
 * own: a canvas that lets nodes move re-runs `layoutDiagram` on the changed
 * model and hands the edges down again. The drawing is hidden from assistive
 * technology, as a node's is, since React Flow's edge wrapper around it
 * carries the accessible name.
 */
export function CanvasEdgeBody({
  data,
}: EdgeProps<CanvasFlowEdge>): ReactElement | null {
  return data === undefined ? null : (
    <g aria-hidden="true">
      <FlowGlyph edge={data.edge} />
    </g>
  );
}

/**
 * The anchor a flow's free end rides on: one handle, so React Flow can
 * resolve an edge that ends there, and nothing drawn. The flow's own glyph
 * carries the line all the way to the free position, so a mark here would be
 * ink the headless render does not lay down.
 */
export function CanvasFreeEndBody(): ReactElement {
  return <Handle type="source" position={Position.Top} />;
}

/**
 * The React Flow node type of every element kind a diagram places as a box,
 * plus the anchor a flow's free end rides on.
 */
export const canvasNodeTypes = {
  actor: CanvasNodeBody,
  process: CanvasNodeBody,
  store: CanvasNodeBody,
  text: CanvasNodeBody,
  'boundary-box': CanvasNodeBody,
  'boundary-curve': CanvasNodeBody,
  [freeEndNodeKind]: CanvasFreeEndBody,
} as const satisfies Record<CanvasNodeKind, typeof CanvasNodeBody> &
  Record<typeof freeEndNodeKind, typeof CanvasFreeEndBody>;

/** The React Flow edge type of a flow. */
export const canvasEdgeTypes = { flow: CanvasEdgeBody } as const;

/**
 * The laid-out nodes as React Flow's own, each carrying the model's position
 * and extent explicitly so React Flow measures nothing. A boundary curve
 * rides as a node too, sized to the box its waypoints span, so it drags and
 * selects as one thing. Flows are left out: they come over as edges through
 * {@link toReactFlowEdges}, and an end of one that belongs to no element
 * rides on an anchor of its own from {@link freeEndNodes}.
 */
export function toReactFlowNodes(layout: CanvasLayout): CanvasFlowNode[] {
  return layout.nodes.map((node) => ({
    id: node.id,
    type: node.kind,
    position: node.position,
    width: node.size.width,
    height: node.size.height,
    data: { node },
  }));
}

/**
 * The id of the node a flow's free end rides on, the flow's own id with the
 * side appended. It is derived rather than stored, so the edge and the
 * anchor agree without either holding a reference to the other.
 */
export function flowEndNodeId(flow: ElementId, side: FlowEndSide): string {
  return `${flow}-${side}`;
}

/**
 * The laid-out flows as React Flow's own edges. A React Flow edge runs
 * between two nodes, so an end the model leaves free takes the anchor
 * {@link freeEndNodes} places at that position. The handle each attached end
 * names is the side the layout resolved, so React Flow's own idea of where
 * an edge runs matches the drawn line.
 */
export function toReactFlowEdges(layout: CanvasLayout): CanvasFlowEdge[] {
  return layout.edges.map((edge) => ({
    id: edge.id,
    type: 'flow',
    source: edge.sourceElement ?? flowEndNodeId(edge.id, 'source'),
    target: edge.targetElement ?? flowEndNodeId(edge.id, 'target'),
    sourceHandle: edge.sourceSide,
    targetHandle: edge.targetSide,
    data: { edge },
  }));
}

/**
 * One anchor node per free flow end, so React Flow resolves an edge that
 * ends at a position belonging to no element. An anchor is not draggable,
 * not selectable, not focusable and hidden from assistive technology: it is
 * a place for an edge to end, not a thing on the diagram.
 */
export function freeEndNodes(layout: CanvasLayout): CanvasFreeEndNode[] {
  return layout.edges.flatMap((edge) => [
    ...anchorOf(edge, 'source'),
    ...anchorOf(edge, 'target'),
  ]);
}

function anchorOf(edge: CanvasEdge, side: FlowEndSide): CanvasFreeEndNode[] {
  const element = side === 'source' ? edge.sourceElement : edge.targetElement;
  if (element !== undefined) {
    return [];
  }
  return [
    {
      id: flowEndNodeId(edge.id, side),
      type: freeEndNodeKind,
      position: side === 'source' ? edge.source : edge.target,
      width: anchorExtent,
      height: anchorExtent,
      data: {},
      draggable: false,
      selectable: false,
      focusable: false,
      connectable: false,
      deletable: false,
      domAttributes: { 'aria-hidden': true },
    },
  ];
}
