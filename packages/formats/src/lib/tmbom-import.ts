import type { TmbomDocument } from '@saerskriven/wire-tmbom';
import { importContext } from './import-model.js';
import { tmbomGraph } from './tmbom-graph.js';
import { tmbomRegister } from './tmbom-register.js';

/** Converts a TM-BOM graph and register into one native model. */
export function mapTmbom(document: TmbomDocument) {
  const context = importContext();
  context.fields(document, [
    '$schema',
    'scope',
    'description',
    'actors',
    'components',
    'data_stores',
    'data_flows',
    'data_sets',
    'trust_zones',
    'threats',
    'controls',
    'assumptions',
  ]);
  const scope = context.fields(document.scope, ['title', 'description']);
  const elements = tmbomGraph(document, context);
  const { threats, mitigations, assumptions, unconfirmed } = tmbomRegister(
    document,
    context,
  );
  context.omitted(document);
  return {
    context,
    input: {
      metadata: {
        title: scope.title,
        owner: '',
        contributors: [],
        description: [
          scope.description,
          document.description ?? '',
          ...unconfirmed.map((prose) => `Unconfirmed assumption: ${prose}`),
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
      diagrams: [{ id: 'tmbom-diagram', title: scope.title, elements }],
      threats,
      mitigations,
      assumptions,
      lastIssuedThreatNumber: threats.length,
    },
  };
}
