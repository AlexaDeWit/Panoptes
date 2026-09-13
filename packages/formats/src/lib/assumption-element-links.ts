import { assumptionIdSchema } from '@saerskriven/model';
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
 * One `narrowed` divergence for each assumption of a version 1 document
 * whose `elements` list held an id. An assumption whose id the model does
 * not accept is skipped, since a read of that document refuses it.
 */
export function droppedAssumptionElementLinks(
  document: SaerskrivenYamlDocument,
): Divergence[] {
  return document.assumptions.flatMap((assumption): Divergence[] => {
    const id = assumptionIdSchema.safeParse(assumption.id);
    return assumption.elements.length === 0 || !id.success
      ? []
      : [
          {
            subject: { kind: 'assumption', id: id.data },
            detail: 'its element links, which an assumption does not hold',
            reason: 'narrowed',
          },
        ];
  });
}
