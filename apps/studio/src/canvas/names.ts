import type {
  CanvasEdge,
  CanvasLayout,
  CanvasNode,
  CanvasNodeKind,
  ThreatBadge,
} from '@panoptes/canvas';
import type { ElementId } from '@panoptes/model';

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
 * what the element is called, what kind it is, and what its badge says. A
 * flow also names the elements its ends attach to.
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
