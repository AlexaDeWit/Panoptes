import type { Model } from '@saerskriven/model';
import type { SaerskrivenYamlDocument } from '@saerskriven/wire-saerskriven-yaml';
import type { Divergence } from './divergence.js';

/** A version 1 document with the `elements` list of every assumption emptied, since an assumption links threats only. */
export function withoutAssumptionElementLinks(
  document: SaerskrivenYamlDocument,
): SaerskrivenYamlDocument {
  return {
    ...document,
    assumptions: document.assumptions.map((assumption) => ({
      ...assumption,
      elements: [],
    })),
  };
}

/**
 * One `narrowed` divergence for each assumption of `document` whose
 * `elements` list held an id, naming the assumption as `model`, the model
 * read from that document, holds it.
 */
export function droppedAssumptionElementLinks(
  document: SaerskrivenYamlDocument,
  model: Model,
): Divergence[] {
  const linked = new Map(
    document.assumptions
      .filter((assumption) => assumption.elements.length > 0)
      .map((assumption) => [assumption.id, assumption.elements.length]),
  );
  return model.assumptions.flatMap((assumption): Divergence[] => {
    const links = linked.get(assumption.id);
    return links === undefined
      ? []
      : [
          {
            subject: { kind: 'assumption', id: assumption.id },
            detail: `the links to ${String(links)} elements, which an assumption does not hold`,
            reason: 'narrowed',
          },
        ];
  });
}
