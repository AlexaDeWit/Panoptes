import type {
  CiaCategory,
  CiaDieCategory,
  CustomCategory,
  LinddunCategory,
  Severity,
  StrideCategory,
  ThreatCategory,
  ThreatStatus,
} from '@panoptes/model';
import type { ThreatDragonThreat } from './threat-dragon-wire.js';

type ThreatOf<Methodology extends ThreatDragonThreat['modelType']> = Extract<
  ThreatDragonThreat,
  { modelType: Methodology }
>;

const statuses: Record<ThreatDragonThreat['status'], ThreatStatus> = {
  NotApplicable: 'not-applicable',
  Open: 'open',
  Mitigated: 'mitigated',
  Accepted: 'accepted-risk',
};

const severities: Record<ThreatDragonThreat['severity'], Severity> = {
  TBD: 'tbd',
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
};

const strideCategories: Record<
  ThreatOf<'STRIDE'>['type'],
  StrideCategory['category']
> = {
  Spoofing: 'spoofing',
  Tampering: 'tampering',
  Repudiation: 'repudiation',
  'Information disclosure': 'information-disclosure',
  'Denial of service': 'denial-of-service',
  'Elevation of privilege': 'elevation-of-privilege',
};

const linddunCategories: Record<
  ThreatOf<'LINDDUN'>['type'],
  LinddunCategory['category']
> = {
  Linkability: 'linking',
  Identifiability: 'identifying',
  'Non-repudiation': 'non-repudiation',
  Detectability: 'detecting',
  'Disclosure of information': 'data-disclosure',
  Unawareness: 'unawareness',
  'Non-compliance': 'non-compliance',
};

const ciaCategories: Record<ThreatOf<'CIA'>['type'], CiaCategory['category']> =
  {
    Confidentiality: 'confidentiality',
    Integrity: 'integrity',
    Availability: 'availability',
  };

const ciaDieCategories: Record<
  ThreatOf<'CIADIE'>['type'],
  CiaDieCategory['category']
> = {
  Confidentiality: 'confidentiality',
  Integrity: 'integrity',
  Availability: 'availability',
  Distributed: 'distributed',
  Immutable: 'immutable',
  Ephemeral: 'ephemeral',
};

/**
 * A Threat Dragon status as the model's own. Threat Dragon 2.6.2 offers
 * only NotApplicable, Open, and Mitigated, and writes Accepted as well,
 * which the Écluse file uses and which is the risk a team has decided to
 * carry rather than treat.
 */
export function toThreatStatus(
  status: ThreatDragonThreat['status'],
): ThreatStatus {
  return statuses[status];
}

/** A Threat Dragon severity as the model's own. */
export function toSeverity(severity: ThreatDragonThreat['severity']): Severity {
  return severities[severity];
}

/**
 * A Threat Dragon threat's methodology and category as the model's own.
 *
 * STRIDE, LINDDUN, and CIA name the same categories under different words,
 * and LINDDUN is the one that renamed them: Threat Dragon still ships the
 * older Linkability, Identifiability, Detectability, and Disclosure of
 * information. `DIE` joins `CIADIE` because Threat Dragon treats it as an
 * alias of it and its three categories are the DIE half of that set.
 *
 * PLOT4ai and the generic methodology fall to the custom category instead.
 * Threat Dragon ships the eight-category PLOT4ai set that predates the
 * library's current one, so its categories are not the ones the model
 * enumerates, and a generic threat's category is whatever its author
 * typed. Both carry Threat Dragon's own methodology name and category
 * string through unchanged, `default` included, which is what Threat
 * Dragon stores for a generic threat: renaming either would be a claim the
 * file did not make, and a read has no divergence to report it with.
 */
export function toThreatCategory(threat: ThreatDragonThreat): ThreatCategory {
  if (threat.modelType === 'STRIDE') {
    return { methodology: 'STRIDE', category: strideCategories[threat.type] };
  }
  if (threat.modelType === 'LINDDUN') {
    return { methodology: 'LINDDUN', category: linddunCategories[threat.type] };
  }
  if (threat.modelType === 'CIA') {
    return { methodology: 'CIA', category: ciaCategories[threat.type] };
  }
  if (threat.modelType === 'CIADIE' || threat.modelType === 'DIE') {
    return { methodology: 'CIA-DIE', category: ciaDieCategories[threat.type] };
  }
  return toCustomCategory(threat.modelType, threat.type);
}

function toCustomCategory(
  methodologyName: 'PLOT4ai' | 'Generic' | 'default',
  category: string,
): CustomCategory {
  return { methodology: 'custom', methodologyName, category };
}
