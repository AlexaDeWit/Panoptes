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

/**
 * One element as a React Flow node: the shared glyph at the model's own
 * width and height, and a handle at each side midpoint. Every handle is of
 * type `source`, so the canvas that mounts these passes
 * `connectionMode={ConnectionMode.Loose}` for a flow to be able to end on
 * one. The wrapper adds nothing of its own to the drawing.
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
 * model and hands the edges down again.
 */
export function CanvasEdgeBody({
  data,
}: EdgeProps<CanvasFlowEdge>): ReactElement | null {
  return data === undefined ? null : <FlowGlyph edge={data.edge} />;
}

/** The React Flow node type of every element kind a diagram places as a box. */
export const canvasNodeTypes = {
  actor: CanvasNodeBody,
  process: CanvasNodeBody,
  store: CanvasNodeBody,
  text: CanvasNodeBody,
  'boundary-box': CanvasNodeBody,
  'boundary-curve': CanvasNodeBody,
} as const satisfies Record<CanvasNodeKind, typeof CanvasNodeBody>;

/** The React Flow edge type of a flow. */
export const canvasEdgeTypes = { flow: CanvasEdgeBody } as const;

/**
 * The laid-out nodes as React Flow's own, each carrying the model's position
 * and extent explicitly so React Flow measures nothing. A boundary curve
 * rides as a node too, sized to the box its waypoints span, so it drags and
 * selects as one thing. Flows are left out: a React Flow edge runs between
 * two nodes and a model flow may end at a free position that is no node, so
 * how a free end rides is the interactive canvas's decision to make.
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
