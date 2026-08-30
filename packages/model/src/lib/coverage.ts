import type { Element } from './elements.js';
import type { ElementId } from './ids.js';
import type { Model } from './parse.js';
import { elementsAcross } from './references.js';
import type { Severity, Threat } from './threats.js';

/**
 * Every element of the model no threat references, across all diagrams and
 * in diagram order. These are the unanalyzed corners of a model: nothing
 * has been recorded against them, whether or not they are in scope.
 */
export function elementsWithoutThreats(model: Model): Element[] {
  const linked = new Set<string>(
    model.threats.flatMap((threat) => threat.elements),
  );
  return elementsAcross(model.diagrams).filter(
    (element) => !linked.has(element.id),
  );
}

/**
 * The model's open threats grouped by severity, register order kept within
 * each group. Every severity is a key, mapping to an empty array where no
 * open threat carries it; threats in any other status are absent entirely.
 */
export function openThreatsBySeverity(
  model: Model,
): Record<Severity, Threat[]> {
  const open = model.threats.filter((threat) => threat.status === 'open');
  const carrying = (severity: Severity): Threat[] =>
    open.filter((threat) => threat.severity === severity);
  return {
    low: carrying('low'),
    medium: carrying('medium'),
    high: carrying('high'),
    critical: carrying('critical'),
    tbd: carrying('tbd'),
  };
}

/**
 * How many threats reference each element of the model, keyed by element id
 * and total over every element across all diagrams, so an element no threat
 * references maps to 0. A threat listing the same element twice counts
 * once. Threat status plays no part: the count is of threats recorded, not
 * of threats outstanding.
 */
export function threatCountByElement(model: Model): Map<ElementId, number> {
  const links = new Map<string, number>();
  for (const threat of model.threats) {
    for (const elementId of new Set(threat.elements)) {
      links.set(elementId, (links.get(elementId) ?? 0) + 1);
    }
  }
  return new Map(
    elementsAcross(model.diagrams).map((element) => [
      element.id,
      links.get(element.id) ?? 0,
    ]),
  );
}
