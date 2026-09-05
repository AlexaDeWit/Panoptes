import {
  freeEndNodes,
  toReactFlowEdges,
  toReactFlowNodes,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasFreeEndNode,
  type CanvasLayout,
  type CanvasNode,
} from '@panoptes/canvas';
import type { ElementId } from '@panoptes/model';
import { flowEnds } from './elements.js';
import { accessibleNames } from './names.js';

/** Every node the canvas mounts: an element's own, or a free end's anchor. */
export type DiagramNode = CanvasFlowNode | CanvasFreeEndNode;

/** What the canvas hands React Flow: the diagram's nodes and its flows. */
export type DiagramGraph = {
  readonly nodes: DiagramNode[];
  readonly edges: CanvasFlowEdge[];
};

/**
 * The laid-out diagram as React Flow takes it: every element named for
 * assistive technology and carrying whether the store has it selected and
 * whether a flow can end on it, then the anchors a flow's free end rides on.
 * The nodes and the flows come back together because one pass over the layout
 * names both. A node a flow cannot end on is not connectable, so React Flow
 * refuses the gesture where it starts rather than letting it settle into an
 * edit the store would drop.
 *
 * Every node and every edge object is built afresh here, so a selection
 * rebuilds them all and React Flow re-renders each one. That is one pass
 * over a diagram's elements with nothing measured, which is what lets the
 * canvas hold no view of the model of its own.
 */
export function diagramGraph(
  layout: CanvasLayout,
  selection: ElementId | undefined,
): DiagramGraph {
  const names = accessibleNames(layout);
  const ends = new Set<string>(flowEnds(layout).map((node) => node.id));
  return {
    nodes: [
      ...toReactFlowNodes(layout).map((node) => ({
        ...node,
        selected: node.id === selection,
        connectable: ends.has(node.id),
        ariaLabel: names.get(node.id),
      })),
      ...freeEndNodes(layout),
    ],
    edges: toReactFlowEdges(layout).map((edge) => ({
      ...edge,
      selected: edge.id === selection,
      ariaLabel: names.get(edge.id),
    })),
  };
}

/** Every node the layout drew, keyed by the id React Flow knows it by. */
export function nodesById(
  layout: CanvasLayout,
): ReadonlyMap<string, CanvasNode> {
  return new Map(layout.nodes.map((node) => [node.id, node]));
}

/**
 * Every element the layout drew, node or flow, keyed by the id React Flow
 * knows it by. A change naming an id this map does not hold names no
 * element: a free end's anchor is the case in the tree.
 */
export function elementIds(
  layout: CanvasLayout,
): ReadonlyMap<string, ElementId> {
  return new Map<string, ElementId>([
    ...layout.nodes.map((node) => [node.id, node.id] as const),
    ...layout.edges.map((edge) => [edge.id, edge.id] as const),
  ]);
}

/**
 * The nodes the model gives, carrying the extents React Flow measured for
 * the ones already on screen. React Flow reads where a flow ends off a
 * measured node and forgets that measurement when it is handed a node
 * without one, so an edit that rebuilt every node would take every flow off
 * the canvas until the next measuring pass.
 */
export function withMeasurements(
  nodes: readonly DiagramNode[],
  onScreen: readonly DiagramNode[],
): DiagramNode[] {
  const measured = new Map(onScreen.map((node) => [node.id, node.measured]));
  return nodes.map((node) => {
    const extent = measured.get(node.id);
    return extent === undefined ? node : { ...node, measured: extent };
  });
}
