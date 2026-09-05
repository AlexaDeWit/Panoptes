import {
  freeEndNodes,
  toReactFlowEdges,
  toReactFlowNodes,
  type CanvasEdge,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasFreeEndNode,
  type CanvasLayout,
  type CanvasNode,
  type CanvasNodeKind,
  type ThreatBadge,
} from '@panoptes/canvas';
import type { ElementId } from '@panoptes/model';

/** Every node the canvas mounts: an element's own, or a free end's anchor. */
export type DiagramNode = CanvasFlowNode | CanvasFreeEndNode;

const kindWords = {
  actor: 'actor',
  process: 'process',
  store: 'store',
  text: 'text',
  'boundary-box': 'trust boundary',
  'boundary-curve': 'trust boundary',
} as const satisfies Record<CanvasNodeKind, string>;

const freeEndWords = 'a free point';

/**
 * What every element the layout drew is called to assistive technology,
 * keyed by the id React Flow knows it by. The glyphs are hidden from a
 * screen reader, so a name here is the only account of the element it has:
 * what the element is called, what kind it is, and what its badge says.
 */
export function accessibleNames(
  layout: CanvasLayout,
): ReadonlyMap<string, string> {
  const nodes = new Map(layout.nodes.map((node) => [node.id, node]));
  return new Map<string, string>([
    ...layout.nodes.map((node) => [node.id, nodeName(node)] as const),
    ...layout.edges.map((edge) => [edge.id, edgeName(edge, nodes)] as const),
  ]);
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
 * The diagram's nodes as React Flow takes them: the elements, each named for
 * assistive technology and carrying whether the store has it selected, then
 * the anchors a flow's free end rides on.
 */
export function diagramNodes(
  layout: CanvasLayout,
  selection: ElementId | undefined,
): DiagramNode[] {
  const names = accessibleNames(layout);
  return [
    ...toReactFlowNodes(layout).map((node) => ({
      ...node,
      selected: node.id === selection,
      ariaLabel: names.get(node.id),
    })),
    ...freeEndNodes(layout),
  ];
}

/**
 * The diagram's flows as React Flow takes them, each named for assistive
 * technology and carrying whether the store has it selected.
 */
export function diagramEdges(
  layout: CanvasLayout,
  selection: ElementId | undefined,
): CanvasFlowEdge[] {
  const names = accessibleNames(layout);
  return toReactFlowEdges(layout).map((edge) => ({
    ...edge,
    selected: edge.id === selection,
    ariaLabel: names.get(edge.id),
  }));
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

function nodeName(node: CanvasNode): string {
  return spoken([node.name, kindWords[node.kind], ...badgeWords(node.badge)]);
}

function edgeName(
  edge: CanvasEdge,
  nodes: ReadonlyMap<ElementId, CanvasNode>,
): string {
  return spoken([
    edge.name,
    'flow',
    `from ${endName(edge.sourceElement, nodes)} to ${endName(edge.targetElement, nodes)}`,
    ...badgeWords(edge.badge),
  ]);
}

function endName(
  element: ElementId | undefined,
  nodes: ReadonlyMap<ElementId, CanvasNode>,
): string {
  if (element === undefined) {
    return freeEndWords;
  }
  const node = nodes.get(element);
  if (node === undefined) {
    return element;
  }
  return node.name === '' ? kindWords[node.kind] : node.name;
}

function badgeWords(badge: ThreatBadge | undefined): string[] {
  if (badge === undefined) {
    return [];
  }
  return [
    badge.count === 1 ? '1 open threat' : `${badge.count} open threats`,
    badge.severity === 'undecided'
      ? 'severity not assessed'
      : `highest severity ${badge.severity}`,
  ];
}

function spoken(parts: readonly string[]): string {
  return parts.filter((part) => part !== '').join(', ');
}
