import type { ElementId } from './ids.js';
import type { Element } from './elements.js';
import type { ParseIssue } from './parse.js';

/** Checks declared relationships without inferring geometry or reciprocal assertions. */
export function relationshipIssues(
  element: Element,
  known: ReadonlyMap<ElementId, Element>,
): ParseIssue[] {
  const lists =
    element.kind === 'flow'
      ? [
          {
            field: 'trustBoundaryIds',
            ids: element.trustBoundaryIds,
            kind: 'trust-boundary',
          },
        ]
      : element.kind === 'trust-boundary'
        ? [
            {
              field: 'containedElements',
              ids: element.containedElements,
              kind: undefined,
            },
            {
              field: 'crossingFlows',
              ids: element.crossingFlows,
              kind: 'flow',
            },
          ]
        : [];
  return lists.flatMap(({ field, ids, kind }) =>
    (ids ?? []).flatMap((reference, index): ParseIssue[] => {
      const target = known.get(reference);
      return target !== undefined &&
        reference !== element.id &&
        (kind === undefined || target.kind === kind)
        ? []
        : [
            {
              path: [field, index],
              code: 'custom',
              message: `${field} references "${reference}", which must name ${kind ?? 'another element'} in the element's own diagram.`,
            },
          ];
    }),
  );
}

/** Restricts declared lists after explicit deletion or selection copying, retaining absent and empty lists. */
export function restrictRelationships(
  element: Element,
  retained: ReadonlySet<string>,
): Element {
  if (element.kind === 'flow' && element.trustBoundaryIds !== undefined) {
    return {
      ...element,
      trustBoundaryIds: element.trustBoundaryIds.filter((id) =>
        retained.has(id),
      ),
    };
  }
  if (element.kind === 'trust-boundary') {
    return {
      ...element,
      ...(element.containedElements === undefined
        ? {}
        : {
            containedElements: element.containedElements.filter((id) =>
              retained.has(id),
            ),
          }),
      ...(element.crossingFlows === undefined
        ? {}
        : {
            crossingFlows: element.crossingFlows.filter((id) =>
              retained.has(id),
            ),
          }),
    };
  }
  return element;
}
