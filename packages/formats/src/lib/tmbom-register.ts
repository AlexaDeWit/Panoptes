import type { TmbomDocument } from '@saerskriven/wire-tmbom';
import {
  importId,
  type ImportAssumption,
  type ImportContext,
  type ImportThreat,
} from './import-model.js';
import { tmbomNodeId } from './tmbom-graph.js';

/** Imports threats and controls, retaining unconfirmed assumptions as prose. */
export function tmbomRegister(document: TmbomDocument, context: ImportContext) {
  const { fields, report } = context;
  const componentIndex = new Set(
    document.components.map((component) => component.symbolic_name),
  );
  const threatIndex = context.index(
    document.threats ?? [],
    (threat) => threat.symbolic_name,
    'threats',
  );
  context.index(
    document.controls ?? [],
    (control) => control.symbolic_name,
    'controls',
  );
  const threats: ImportThreat[] = (document.threats ?? []).map(
    (threat, index) => {
      fields(threat, [
        'symbolic_name',
        'title',
        'description',
        'components_affected',
        'event',
      ]);
      for (const id of threat.components_affected ?? [])
        if (!componentIndex.has(id))
          context.problem(
            ['threats', index, 'components_affected'],
            `Unknown component ${JSON.stringify(id)}`,
          );
      return {
        id: importId('tmbom-threat', threat.symbolic_name),
        number: index + 1,
        title: threat.title,
        description: `${threat.description}\n\nTrigger: ${threat.event}`,
        severity: 'undecided',
        status: 'open',
        category: {
          methodology: 'custom',
          methodologyName: 'TM-BOM',
          category: 'Unspecified',
        },
        mitigation: '',
        elements: (threat.components_affected ?? []).map((id) =>
          tmbomNodeId('process', id),
        ),
      };
    },
  );
  const mitigations = (document.controls ?? []).flatMap((control) => {
    if (control.status === 'retired' || control.status === 'wont_do') return [];
    fields(control, [
      'symbolic_name',
      'title',
      'description',
      'threats',
      'status',
    ]);
    for (const id of control.threats)
      if (!threatIndex.has(id))
        context.problem(
          ['controls', control.symbolic_name, 'threats'],
          `Unknown threat ${JSON.stringify(id)}`,
        );
    const status =
      control.status === 'active'
        ? ('implemented' as const)
        : ('proposed' as const);
    if (control.status !== 'active' && control.status !== 'suggested')
      report(
        `Control ${JSON.stringify(control.symbolic_name)} imports as proposed. Its original status remains in the description.`,
      );
    return [
      {
        id: importId('tmbom-control', control.symbolic_name),
        title: control.title,
        prose: `${control.description}\n\nSource status: ${control.status}`,
        status,
        threats: control.threats.map((id) => importId('tmbom-threat', id)),
      },
    ];
  });
  const assumptions: ImportAssumption[] = [];
  const unconfirmed: string[] = [];
  for (const [index, assumption] of (document.assumptions ?? []).entries()) {
    fields(assumption, ['description', 'validity']);
    if (
      assumption.validity === undefined ||
      assumption.validity === 'unconfirmed'
    ) {
      unconfirmed.push(assumption.description);
      report(
        `Assumption ${String(index)} is unconfirmed and remains prose in the model description.`,
      );
    } else {
      assumptions.push({
        id: importId('tmbom-assumption', String(index)),
        prose: assumption.description,
        status: assumption.validity === 'confirmed' ? 'valid' : 'invalidated',
        elements: [],
        threats: [],
      });
    }
  }
  if (threats.length > 0)
    report(
      'Threats import as open with undecided severity and an unspecified category. Separate risk assessments are not converted into threat severity.',
    );
  return { threats, mitigations, assumptions, unconfirmed };
}
