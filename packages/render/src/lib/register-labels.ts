import type { RegisterBadge } from '@saerskriven/canvas';
import type {
  AssumptionStatus,
  CustomCategory,
  MitigationStatus,
  Severity,
  ThreatCategory,
  ThreatFlag,
  ThreatStatus,
} from '@saerskriven/model';

const severityLabels = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
  undecided: 'Undecided',
} satisfies Record<Severity, string>;

const statusLabels = {
  open: 'Open',
  mitigated: 'Mitigated',
  transferred: 'Transferred',
  avoided: 'Avoided',
  'accepted-risk': 'Accepted risk',
  eliminated: 'Eliminated',
  'not-applicable': 'Not applicable',
} satisfies Record<ThreatStatus, string>;

const mitigationLabels = {
  proposed: 'Proposed',
  implemented: 'Implemented',
  verified: 'Verified',
} satisfies Record<MitigationStatus, string>;

const assumptionLabels = {
  unconfirmed: 'Unconfirmed',
  valid: 'Valid',
  invalidated: 'Invalidated',
} satisfies Record<AssumptionStatus, string>;

const flagLabels = {
  'mitigated-without-implemented-work': 'Mitigated without implemented work',
  'rests-on-invalidated-assumption': 'Rests on an invalidated assumption',
} satisfies Record<ThreatFlag, string>;

type EnumeratedCategory = Exclude<ThreatCategory, CustomCategory>;

type CategoryLabels = {
  [Variant in EnumeratedCategory as Variant['methodology']]: Record<
    Variant['category'],
    string
  >;
};

const categoryLabels = {
  STRIDE: {
    spoofing: 'Spoofing',
    tampering: 'Tampering',
    repudiation: 'Repudiation',
    'information-disclosure': 'Information disclosure',
    'denial-of-service': 'Denial of service',
    'elevation-of-privilege': 'Elevation of privilege',
  },
  LINDDUN: {
    linking: 'Linking',
    identifying: 'Identifying',
    'non-repudiation': 'Non-repudiation',
    detecting: 'Detecting',
    'data-disclosure': 'Data disclosure',
    unawareness: 'Unawareness',
    'non-compliance': 'Non-compliance',
  },
  CIA: {
    confidentiality: 'Confidentiality',
    integrity: 'Integrity',
    availability: 'Availability',
  },
  'CIA-DIE': {
    confidentiality: 'Confidentiality',
    integrity: 'Integrity',
    availability: 'Availability',
    distributed: 'Distributed',
    immutable: 'Immutable',
    ephemeral: 'Ephemeral',
  },
  PLOT4ai: {
    'accountability-and-human-oversight': 'Accountability and human oversight',
    'bias-fairness-and-discrimination': 'Bias, fairness and discrimination',
    cybersecurity: 'Cybersecurity',
    'data-and-data-governance': 'Data and data governance',
    'ethics-and-human-rights': 'Ethics and human rights',
    'privacy-and-data-protection': 'Privacy and data protection',
    'safety-and-environmental-impact': 'Safety and environmental impact',
    'transparency-and-accessibility': 'Transparency and accessibility',
  },
} satisfies CategoryLabels;

/** The display label of a badge, from a table the compiler checks for totality. */
export function badgeLabel(badge: RegisterBadge): string {
  if (badge.kind === 'severity') {
    return severityLabels[badge.value];
  }
  if (badge.kind === 'status') {
    return statusLabels[badge.value];
  }
  if (badge.kind === 'mitigation') {
    return mitigationLabels[badge.value];
  }
  if (badge.kind === 'assumption') {
    return assumptionLabels[badge.value];
  }
  return flagLabels[badge.value];
}

/** A category's display label followed by its methodology in parentheses. */
export function categoryLabel(category: ThreatCategory): string {
  return `${categoryName(category)} (${methodologyName(category)})`;
}

function categoryName(category: ThreatCategory): string {
  if (category.methodology === 'STRIDE') {
    return categoryLabels.STRIDE[category.category];
  }
  if (category.methodology === 'LINDDUN') {
    return categoryLabels.LINDDUN[category.category];
  }
  if (category.methodology === 'CIA') {
    return categoryLabels.CIA[category.category];
  }
  if (category.methodology === 'CIA-DIE') {
    return categoryLabels['CIA-DIE'][category.category];
  }
  if (category.methodology === 'PLOT4ai') {
    return categoryLabels.PLOT4ai[category.category];
  }
  return category.category;
}

function methodologyName(category: ThreatCategory): string {
  return category.methodology === 'custom'
    ? category.methodologyName
    : category.methodology;
}
