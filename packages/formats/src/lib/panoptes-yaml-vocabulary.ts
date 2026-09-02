import type {
  AssumptionStatus,
  CiaCategory,
  CiaDieCategory,
  LinddunCategory,
  MitigationStatus,
  Plot4aiCategory,
  Severity,
  StrideCategory,
  ThreatCategory,
  ThreatStatus,
} from '@panoptes/model';
import type {
  PanoptesYamlAssumptionStatus,
  PanoptesYamlCategory,
  PanoptesYamlCiaCategory,
  PanoptesYamlCiaDieCategory,
  PanoptesYamlLinddunCategory,
  PanoptesYamlMitigationStatus,
  PanoptesYamlPlot4aiCategory,
  PanoptesYamlSeverity,
  PanoptesYamlStrideCategory,
  PanoptesYamlThreatStatus,
} from '@panoptes/wire-panoptes-yaml';

/**
 * The file's severities as the model holds them.
 *
 * Every vocabulary below is two tables rather than one reversible table,
 * each annotated with the whole `Record` of the side it reads, so a member
 * added to either vocabulary is a compile error here rather than a value
 * falling through. The two key sets are free to stop matching: the format
 * is a contract with files in the wild and the model is not, and that they
 * hold the same words today is a coincidence this file is where anyone
 * would notice ending.
 *
 * No table here is lossy in either direction, so no caller reports a
 * divergence for a vocabulary. That is the difference between a native
 * format and Threat Dragon's, where `threat-dragon-vocabulary.ts` reads a
 * foreign label that may have no home at all.
 */
export const severitiesToModel = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
  undecided: 'undecided',
} as const satisfies Record<PanoptesYamlSeverity, Severity>;

/** The model's severities as the file states them. */
export const severitiesToWire = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
  undecided: 'undecided',
} as const satisfies Record<Severity, PanoptesYamlSeverity>;

/** The file's threat statuses as the model holds them. */
export const threatStatusesToModel = {
  open: 'open',
  mitigated: 'mitigated',
  transferred: 'transferred',
  avoided: 'avoided',
  'accepted-risk': 'accepted-risk',
  eliminated: 'eliminated',
  'not-applicable': 'not-applicable',
} as const satisfies Record<PanoptesYamlThreatStatus, ThreatStatus>;

/** The model's threat statuses as the file states them. */
export const threatStatusesToWire = {
  open: 'open',
  mitigated: 'mitigated',
  transferred: 'transferred',
  avoided: 'avoided',
  'accepted-risk': 'accepted-risk',
  eliminated: 'eliminated',
  'not-applicable': 'not-applicable',
} as const satisfies Record<ThreatStatus, PanoptesYamlThreatStatus>;

/** The file's mitigation statuses as the model holds them. */
export const mitigationStatusesToModel = {
  proposed: 'proposed',
  implemented: 'implemented',
  verified: 'verified',
} as const satisfies Record<PanoptesYamlMitigationStatus, MitigationStatus>;

/** The model's mitigation statuses as the file states them. */
export const mitigationStatusesToWire = {
  proposed: 'proposed',
  implemented: 'implemented',
  verified: 'verified',
} as const satisfies Record<MitigationStatus, PanoptesYamlMitigationStatus>;

/** The file's assumption statuses as the model holds them. */
export const assumptionStatusesToModel = {
  valid: 'valid',
  invalidated: 'invalidated',
} as const satisfies Record<PanoptesYamlAssumptionStatus, AssumptionStatus>;

/** The model's assumption statuses as the file states them. */
export const assumptionStatusesToWire = {
  valid: 'valid',
  invalidated: 'invalidated',
} as const satisfies Record<AssumptionStatus, PanoptesYamlAssumptionStatus>;

/** The file's STRIDE categories as the model holds them. */
export const strideCategoriesToModel = {
  spoofing: 'spoofing',
  tampering: 'tampering',
  repudiation: 'repudiation',
  'information-disclosure': 'information-disclosure',
  'denial-of-service': 'denial-of-service',
  'elevation-of-privilege': 'elevation-of-privilege',
} as const satisfies Record<
  PanoptesYamlStrideCategory['category'],
  StrideCategory['category']
>;

/** The model's STRIDE categories as the file states them. */
export const strideCategoriesToWire = {
  spoofing: 'spoofing',
  tampering: 'tampering',
  repudiation: 'repudiation',
  'information-disclosure': 'information-disclosure',
  'denial-of-service': 'denial-of-service',
  'elevation-of-privilege': 'elevation-of-privilege',
} as const satisfies Record<
  StrideCategory['category'],
  PanoptesYamlStrideCategory['category']
>;

/** The file's LINDDUN categories as the model holds them. */
export const linddunCategoriesToModel = {
  linking: 'linking',
  identifying: 'identifying',
  'non-repudiation': 'non-repudiation',
  detecting: 'detecting',
  'data-disclosure': 'data-disclosure',
  unawareness: 'unawareness',
  'non-compliance': 'non-compliance',
} as const satisfies Record<
  PanoptesYamlLinddunCategory['category'],
  LinddunCategory['category']
>;

/** The model's LINDDUN categories as the file states them. */
export const linddunCategoriesToWire = {
  linking: 'linking',
  identifying: 'identifying',
  'non-repudiation': 'non-repudiation',
  detecting: 'detecting',
  'data-disclosure': 'data-disclosure',
  unawareness: 'unawareness',
  'non-compliance': 'non-compliance',
} as const satisfies Record<
  LinddunCategory['category'],
  PanoptesYamlLinddunCategory['category']
>;

/** The file's CIA categories as the model holds them. */
export const ciaCategoriesToModel = {
  confidentiality: 'confidentiality',
  integrity: 'integrity',
  availability: 'availability',
} as const satisfies Record<
  PanoptesYamlCiaCategory['category'],
  CiaCategory['category']
>;

/** The model's CIA categories as the file states them. */
export const ciaCategoriesToWire = {
  confidentiality: 'confidentiality',
  integrity: 'integrity',
  availability: 'availability',
} as const satisfies Record<
  CiaCategory['category'],
  PanoptesYamlCiaCategory['category']
>;

/** The file's CIA-DIE categories as the model holds them. */
export const ciaDieCategoriesToModel = {
  confidentiality: 'confidentiality',
  integrity: 'integrity',
  availability: 'availability',
  distributed: 'distributed',
  immutable: 'immutable',
  ephemeral: 'ephemeral',
} as const satisfies Record<
  PanoptesYamlCiaDieCategory['category'],
  CiaDieCategory['category']
>;

/** The model's CIA-DIE categories as the file states them. */
export const ciaDieCategoriesToWire = {
  confidentiality: 'confidentiality',
  integrity: 'integrity',
  availability: 'availability',
  distributed: 'distributed',
  immutable: 'immutable',
  ephemeral: 'ephemeral',
} as const satisfies Record<
  CiaDieCategory['category'],
  PanoptesYamlCiaDieCategory['category']
>;

/** The file's PLOT4ai categories as the model holds them. */
export const plot4aiCategoriesToModel = {
  'accountability-and-human-oversight': 'accountability-and-human-oversight',
  'bias-fairness-and-discrimination': 'bias-fairness-and-discrimination',
  cybersecurity: 'cybersecurity',
  'data-and-data-governance': 'data-and-data-governance',
  'ethics-and-human-rights': 'ethics-and-human-rights',
  'privacy-and-data-protection': 'privacy-and-data-protection',
  'safety-and-environmental-impact': 'safety-and-environmental-impact',
  'transparency-and-accessibility': 'transparency-and-accessibility',
} as const satisfies Record<
  PanoptesYamlPlot4aiCategory['category'],
  Plot4aiCategory['category']
>;

/** The model's PLOT4ai categories as the file states them. */
export const plot4aiCategoriesToWire = {
  'accountability-and-human-oversight': 'accountability-and-human-oversight',
  'bias-fairness-and-discrimination': 'bias-fairness-and-discrimination',
  cybersecurity: 'cybersecurity',
  'data-and-data-governance': 'data-and-data-governance',
  'ethics-and-human-rights': 'ethics-and-human-rights',
  'privacy-and-data-protection': 'privacy-and-data-protection',
  'safety-and-environmental-impact': 'safety-and-environmental-impact',
  'transparency-and-accessibility': 'transparency-and-accessibility',
} as const satisfies Record<
  Plot4aiCategory['category'],
  PanoptesYamlPlot4aiCategory['category']
>;

/**
 * A category as the file states it, as the model holds it. The methodology
 * picks the table, and a methodology the format does not enumerate carries
 * its own two names across unchanged: the format's custom variant and the
 * model's are the same escape hatch.
 */
export function toModelCategory(
  category: PanoptesYamlCategory,
): ThreatCategory {
  if (category.methodology === 'STRIDE') {
    return {
      methodology: 'STRIDE',
      category: strideCategoriesToModel[category.category],
    };
  }
  if (category.methodology === 'LINDDUN') {
    return {
      methodology: 'LINDDUN',
      category: linddunCategoriesToModel[category.category],
    };
  }
  if (category.methodology === 'CIA') {
    return {
      methodology: 'CIA',
      category: ciaCategoriesToModel[category.category],
    };
  }
  if (category.methodology === 'CIA-DIE') {
    return {
      methodology: 'CIA-DIE',
      category: ciaDieCategoriesToModel[category.category],
    };
  }
  if (category.methodology === 'PLOT4ai') {
    return {
      methodology: 'PLOT4ai',
      category: plot4aiCategoriesToModel[category.category],
    };
  }
  return {
    methodology: 'custom',
    methodologyName: category.methodologyName,
    category: category.category,
  };
}

/**
 * A category as the model holds it, as the file states it. The inverse of
 * {@link toModelCategory}. A methodology added to either side falls to the
 * custom branch these two chains end in, where it stops compiling: the
 * names a custom category needs are not the ones an enumerated variant
 * carries.
 */
export function toWireCategory(category: ThreatCategory): PanoptesYamlCategory {
  if (category.methodology === 'STRIDE') {
    return {
      methodology: 'STRIDE',
      category: strideCategoriesToWire[category.category],
    };
  }
  if (category.methodology === 'LINDDUN') {
    return {
      methodology: 'LINDDUN',
      category: linddunCategoriesToWire[category.category],
    };
  }
  if (category.methodology === 'CIA') {
    return {
      methodology: 'CIA',
      category: ciaCategoriesToWire[category.category],
    };
  }
  if (category.methodology === 'CIA-DIE') {
    return {
      methodology: 'CIA-DIE',
      category: ciaDieCategoriesToWire[category.category],
    };
  }
  if (category.methodology === 'PLOT4ai') {
    return {
      methodology: 'PLOT4ai',
      category: plot4aiCategoriesToWire[category.category],
    };
  }
  return {
    methodology: 'custom',
    methodologyName: category.methodologyName,
    category: category.category,
  };
}
