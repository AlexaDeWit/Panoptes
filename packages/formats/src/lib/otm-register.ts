import type { OtmDocument } from '@saerskriven/wire-otm';
import {
  importId,
  type ImportContext,
  type ImportMitigation,
  type ImportThreat,
} from './import-model.js';
type Component = NonNullable<OtmDocument['components']>[number];
type Occurrence = NonNullable<Component['threats']>[number];
type Definition = NonNullable<OtmDocument['threats']>[number];

/** Preserves independently treated occurrences as separate native threat records. */
export function otmRegister(document: OtmDocument, context: ImportContext) {
  const { fields, report } = context;
  const definitions = context.index(
    document.threats ?? [],
    (item) => item.id,
    'threats',
  );
  const mitigationDefinitions = context.index(
    document.mitigations ?? [],
    (item) => item.id,
    'mitigations',
  );
  const threats: ImportThreat[] = [];
  const mitigations: ImportMitigation[] = [];
  const referencedThreats = new Set<string>();
  const referencedMitigations = new Set<string>();
  const addThreat = (
    definition: Definition,
    occurrence: Occurrence | undefined,
    owner: string,
    attached: readonly string[],
  ): void => {
    fields(definition, ['id', 'name', 'description']);
    if (referencedThreats.has(definition.id))
      report(
        `Threat ${JSON.stringify(definition.id)} becomes separate records for its occurrences.`,
        'split',
      );
    referencedThreats.add(definition.id);
    const id = importId(
      'otm-threat',
      definition.id,
      owner,
      String(threats.length),
    );
    const state = occurrence?.state;
    if (occurrence !== undefined)
      fields(occurrence, ['threat', 'state', 'mitigations']);
    const status = otmThreatStatus(state, context);
    threats.push({
      id,
      number: threats.length + 1,
      title: definition.name,
      description: [
        definition.description ?? '',
        state === undefined ? '' : `Source status: ${state}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      category: {
        methodology: 'custom',
        methodologyName: 'OTM',
        category: 'Unspecified',
      },
      severity: 'undecided',
      status,
      mitigation: '',
      elements: [...attached],
    });
    report(
      `Threat ${JSON.stringify(definition.id)} imports with undecided severity and an unspecified category.`,
    );
    for (const [index, given] of (occurrence?.mitigations ?? []).entries()) {
      if (given === null || given.mitigation === null) continue;
      const mitigation = mitigationDefinitions.get(given.mitigation);
      if (mitigation === undefined) {
        context.problem(
          ['mitigations', index],
          `Unknown mitigation ${JSON.stringify(given.mitigation)}`,
        );
        continue;
      }
      fields(given, ['mitigation', 'state']);
      fields(mitigation, ['id', 'name', 'description']);
      if (referencedMitigations.has(mitigation.id))
        report(
          `Mitigation ${JSON.stringify(mitigation.id)} becomes separate records for its occurrences.`,
          'split',
        );
      referencedMitigations.add(mitigation.id);
      const mitigationStatus =
        given.state === 'implemented'
          ? 'implemented'
          : given.state === 'verified'
            ? 'verified'
            : 'proposed';
      if (
        mitigationStatus === 'proposed' &&
        given.state !== 'required' &&
        given.state !== 'proposed'
      )
        report(
          `Mitigation ${JSON.stringify(mitigation.id)} has source status ${JSON.stringify(given.state)}, retained in its description and imported as proposed.`,
        );
      mitigations.push({
        id: importId('otm-mitigation', mitigation.id, id, String(index)),
        title: mitigation.name,
        prose: [
          mitigation.description ?? '',
          given.state == null ? '' : `Source status: ${given.state}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        status: mitigationStatus,
        threats: [id],
      });
    }
  };
  const occurrences = (
    items: readonly Occurrence[],
    owner: string,
    attached: readonly string[],
  ): void => {
    for (const occurrence of items) {
      const definition = definitions.get(occurrence.threat);
      if (definition === undefined)
        context.problem(
          ['threats'],
          `Unknown threat ${JSON.stringify(occurrence.threat)}`,
        );
      else addThreat(definition, occurrence, owner, attached);
    }
  };
  for (const component of document.components ?? []) {
    const id = importId('otm-component', component.id);
    occurrences(component.threats ?? [], id, [id]);
  }
  for (const flow of document.dataflows ?? []) {
    const attached =
      flow.bidirectional === true
        ? [
            importId('otm-flow', flow.id, 'forward'),
            importId('otm-flow', flow.id, 'reverse'),
          ]
        : [importId('otm-flow', flow.id, 'forward')];
    occurrences(flow.threats ?? [], importId('otm-flow', flow.id), attached);
  }
  for (const definition of definitions.values()) {
    if (!referencedThreats.has(definition.id))
      addThreat(definition, undefined, 'unattached', []);
  }
  for (const definition of mitigationDefinitions.values()) {
    if (referencedMitigations.has(definition.id)) continue;
    fields(definition, ['id', 'name', 'description']);
    mitigations.push({
      id: importId('otm-mitigation', definition.id),
      title: definition.name,
      prose: definition.description ?? '',
      status: 'proposed',
      threats: [],
    });
    report(
      `Unattached mitigation ${JSON.stringify(definition.id)} has no occurrence status and imports as proposed.`,
    );
  }
  return { threats, mitigations };
}

function otmThreatStatus(
  state: string | undefined,
  context: ImportContext,
): ImportThreat['status'] {
  switch (state) {
    case 'exposed':
    case 'open':
      return 'open';
    case 'mitigated':
      return 'mitigated';
    case 'accepted':
    case 'accepted-risk':
      return 'accepted-risk';
    case 'transferred':
      return 'transferred';
    case 'avoided':
      return 'avoided';
    case 'eliminated':
      return 'eliminated';
    case 'not-applicable':
      return 'not-applicable';
    case undefined:
    default:
      context.report(
        `Threat status ${JSON.stringify(state) ?? 'absent'} imports as open. Supplied status text remains in the description.`,
      );
      return 'open';
  }
}
