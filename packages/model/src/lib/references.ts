import type { Element, Flow } from './elements.js';
import type { ElementId } from './ids.js';
import type { Diagram } from './model.js';
import type { Threat } from './threats.js';

/**
 * One attached flow endpoint that cannot anchor where it points: at the
 * flow itself, or at an id absent from the diagram meant to hold the flow.
 */
export type EndpointViolation = {
  readonly side: 'source' | 'target';
  readonly reference: ElementId;
  readonly reason: 'self-anchored' | 'outside-diagram';
};

/**
 * The violations among one flow's attached endpoints, checked against the
 * element ids of the diagram meant to hold it. The self check runs first,
 * so a candidate flow not yet in the diagram reports a self anchor as such
 * rather than as absent. Shared by parseModel's refinements and the graph
 * operations, so both reject the same endpoints.
 */
export function endpointViolationsOf(
  flow: Flow,
  diagramElementIds: ReadonlySet<string>,
): EndpointViolation[] {
  return (['source', 'target'] as const).flatMap(
    (side): EndpointViolation[] => {
      const endpoint = flow[side];
      if (endpoint.kind !== 'attached') {
        return [];
      }
      if (endpoint.element === flow.id) {
        return [{ side, reference: endpoint.element, reason: 'self-anchored' }];
      }
      return diagramElementIds.has(endpoint.element)
        ? []
        : [{ side, reference: endpoint.element, reason: 'outside-diagram' }];
    },
  );
}

/** Ids of the elements one diagram owns. */
export function elementIdsIn(diagram: Diagram): Set<string> {
  return new Set(diagram.elements.map((element) => element.id));
}

/** Every element the given diagrams own, in diagram order. */
export function elementsAcross(diagrams: readonly Diagram[]): Element[] {
  return diagrams.flatMap((diagram) => diagram.elements);
}

/** Ids of every element across the given diagrams. */
export function elementIdsAcross(diagrams: readonly Diagram[]): Set<string> {
  return new Set(elementsAcross(diagrams).map((element) => element.id));
}

/** Ids of the given threats. */
export function threatIdsOf(threats: readonly Threat[]): Set<string> {
  return new Set(threats.map((threat) => threat.id));
}
