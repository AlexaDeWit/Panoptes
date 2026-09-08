import type { OtmDocument } from '@saerskriven/wire-otm';
import { importContext } from './import-model.js';
import { otmGraph } from './otm-graph.js';
import { otmRegister } from './otm-register.js';

/** Converts OTM into a native diagram and separate threat occurrences. */
export function mapOtm(document: OtmDocument) {
  const context = importContext();
  context.fields(document, [
    'otmVersion',
    'project',
    'components',
    'dataflows',
    'trustZones',
    'threats',
    'mitigations',
    'assets',
    'representations',
  ]);
  const project = context.fields(document.project, [
    'id',
    'name',
    'description',
    'owner',
  ]);
  const graph = otmGraph(document, context);
  const register = otmRegister(document, context);
  context.omitted(document);
  return {
    context,
    input: {
      metadata: {
        title: project.name,
        owner: project.owner ?? '',
        description: project.description ?? '',
        contributors: [],
      },
      diagrams: [
        {
          id: context.id('otm-diagram', project.id),
          title: graph.title,
          elements: graph.elements,
        },
      ],
      ...register,
      assumptions: [],
      lastIssuedThreatNumber: register.threats.length,
    },
  };
}
