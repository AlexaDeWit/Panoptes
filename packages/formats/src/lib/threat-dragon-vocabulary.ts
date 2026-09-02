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
import { categoryTranslations } from './threat-dragon-locales.js';
import type { ThreatDragonThreat } from './threat-dragon-wire.js';

/**
 * The fields of a Threat Dragon threat that name its category: the
 * methodology, the label in whatever language its author saw, and, for an
 * Elevation of Privilege threat, the suit of the card it was drawn from.
 * Reading and writing a category both work in these terms alone, so a write
 * can hand its own projection back to the read to see what it would say.
 */
export type ThreatDragonCategoryFields = Pick<
  ThreatDragonThreat,
  'modelType' | 'type' | 'cardSuit'
>;

/**
 * A Threat Dragon value as the internal model holds it, and whether the
 * model holds it exactly. `exact` is false where the codec had to fall
 * back, which is a read's cue to report a divergence.
 */
export type Reading<Value> = {
  readonly value: Value;
  readonly exact: boolean;
};

const unspecified = 'unspecified';

const eop = 'EOP';

const statuses = {
  Open: 'open',
  Mitigated: 'mitigated',
  Transferred: 'transferred',
  Avoided: 'avoided',
  Accepted: 'accepted-risk',
  Eliminated: 'eliminated',
  NotApplicable: 'not-applicable',
} as const satisfies Record<string, ThreatStatus>;

const statusLabels = {
  open: 'Open',
  mitigated: 'Mitigated',
  transferred: 'Transferred',
  avoided: 'Avoided',
  'accepted-risk': 'Accepted',
  eliminated: 'Eliminated',
  'not-applicable': 'NotApplicable',
} as const satisfies Record<ThreatStatus, string>;

const severities = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
  TBD: 'undecided',
  TBA: 'undecided',
} as const satisfies Record<string, Severity>;

const severityLabels = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
  undecided: 'TBD',
} as const satisfies Record<Severity, string>;

const strideCategories = {
  Spoofing: 'spoofing',
  Tampering: 'tampering',
  Repudiation: 'repudiation',
  'Information disclosure': 'information-disclosure',
  'Denial of service': 'denial-of-service',
  'Elevation of privilege': 'elevation-of-privilege',
} as const satisfies Record<string, StrideCategory['category']>;

const strideLabels = {
  spoofing: 'Spoofing',
  tampering: 'Tampering',
  repudiation: 'Repudiation',
  'information-disclosure': 'Information disclosure',
  'denial-of-service': 'Denial of service',
  'elevation-of-privilege': 'Elevation of privilege',
} as const satisfies Record<StrideCategory['category'], string>;

const linddunCategories = {
  Linkability: 'linking',
  Identifiability: 'identifying',
  'Non-repudiation': 'non-repudiation',
  Detectability: 'detecting',
  'Disclosure of information': 'data-disclosure',
  Unawareness: 'unawareness',
  'Non-compliance': 'non-compliance',
} as const satisfies Record<string, LinddunCategory['category']>;

const linddunLabels = {
  linking: 'Linkability',
  identifying: 'Identifiability',
  'non-repudiation': 'Non-repudiation',
  detecting: 'Detectability',
  'data-disclosure': 'Disclosure of information',
  unawareness: 'Unawareness',
  'non-compliance': 'Non-compliance',
} as const satisfies Record<LinddunCategory['category'], string>;

const ciaCategories = {
  Confidentiality: 'confidentiality',
  Integrity: 'integrity',
  Availability: 'availability',
} as const satisfies Record<string, CiaCategory['category']>;

const ciaLabels = {
  confidentiality: 'Confidentiality',
  integrity: 'Integrity',
  availability: 'Availability',
} as const satisfies Record<CiaCategory['category'], string>;

const ciaDieCategories = {
  ...ciaCategories,
  Distributed: 'distributed',
  Immutable: 'immutable',
  Ephemeral: 'ephemeral',
} as const satisfies Record<string, CiaDieCategory['category']>;

const ciaDieLabels = {
  ...ciaLabels,
  distributed: 'Distributed',
  immutable: 'Immutable',
  ephemeral: 'Ephemeral',
} as const satisfies Record<CiaDieCategory['category'], string>;

const ciaDieTranslations = {
  ...categoryTranslations.cia,
  ...categoryTranslations.die,
};

const enumeratedCategories: Readonly<
  Record<string, (label: string) => ThreatCategory | undefined>
> = {
  STRIDE: (label) =>
    paired(
      'STRIDE',
      resolve(strideCategories, categoryTranslations.stride, label),
    ),
  LINDDUN: (label) =>
    paired(
      'LINDDUN',
      resolve(linddunCategories, categoryTranslations.linddun, label),
    ),
  CIA: (label) =>
    paired('CIA', resolve(ciaCategories, categoryTranslations.cia, label)),
  CIADIE: (label) =>
    paired('CIA-DIE', resolve(ciaDieCategories, ciaDieTranslations, label)),
  DIE: (label) =>
    paired('CIA-DIE', resolve(ciaDieCategories, ciaDieTranslations, label)),
};

/**
 * A Threat Dragon status as the model's own. Threat Dragon 2.6.2 offers
 * NotApplicable, Open and Mitigated, writes Accepted as well, and its
 * unreleased main adds the other three treatments. A status this codec does
 * not know reads as open, the state of a threat nobody has dispositioned,
 * and says it was not exact.
 */
export function toThreatStatus(status: string): Reading<ThreatStatus> {
  const known = lookup(statuses, status);
  return { value: known ?? 'open', exact: known !== undefined };
}

/**
 * A Threat Dragon severity as the model's own. Threat Dragon offers TBD and
 * has shipped TBA in a demo model, and both are the model's `undecided`. A
 * severity this codec does not know reads as `undecided` too, which is what
 * an unreadable level amounts to, and says it was not exact.
 */
export function toSeverity(severity: string): Reading<Severity> {
  const known = lookup(severities, severity);
  return { value: known ?? 'undecided', exact: known !== undefined };
}

/**
 * A Threat Dragon threat's methodology and category as the model's own.
 *
 * STRIDE, LINDDUN and CIA name the same categories under different words,
 * and LINDDUN is the one that renamed them: Threat Dragon still ships the
 * older Linkability, Identifiability, Detectability, and Disclosure of
 * information. `DIE` joins `CIADIE` because Threat Dragon treats it as an
 * alias of it. Each label is looked up in the language Threat Dragon wrote
 * it in before the category is read, so a German file and an English one
 * describing the same threat reach the same category.
 *
 * Everything else becomes a custom category carrying Threat Dragon's own
 * methodology name and category string unchanged, `default` included, which
 * is what Threat Dragon stores for a generic threat: renaming either would
 * be a claim the file did not make. That is the model's escape hatch
 * working as intended, so it reads as exact. What is not exact is an
 * enumerated methodology whose label no language of Threat Dragon's names,
 * which falls to custom having lost the category, and an Elevation of
 * Privilege threat, whose card has only a suit the model can hold: the deck
 * and the card number have no home. A methodology or category the file
 * leaves out reads as `unspecified`, since the custom variant holds no
 * empty names.
 */
export function toThreatCategory(
  threat: ThreatDragonCategoryFields,
): Reading<ThreatCategory> {
  const methodology = threat.modelType ?? unspecified;
  if (methodology === eop) {
    return {
      value: custom(methodology, threat.cardSuit ?? unspecified),
      exact: false,
    };
  }
  const label = threat.type ?? unspecified;
  const enumerated = lookup(enumeratedCategories, methodology);
  if (enumerated === undefined) {
    return { value: custom(methodology, label), exact: true };
  }
  const category = enumerated(label);
  return category === undefined
    ? { value: custom(methodology, label), exact: false }
    : { value: category, exact: true };
}

/**
 * The internal status as Threat Dragon spells it. Every state the model
 * holds has a spelling, so nothing is lost, and the spec walks the schema's
 * own options to hold this table and the reading table above to each other.
 */
export function fromThreatStatus(status: ThreatStatus): string {
  return statusLabels[status];
}

/**
 * The internal severity as Threat Dragon spells it. `undecided` is written
 * TBD, the one of the two spellings Threat Dragon's own editor offers; a
 * file that said TBA keeps saying it, because a write leaves a value the
 * source already holds alone where it still reads back the same.
 */
export function fromSeverity(severity: Severity): string {
  return severityLabels[severity];
}

/**
 * The internal category as the fields a Threat Dragon threat names it with.
 * The methodologies the model enumerates are written in Threat Dragon's own
 * English labels, since the file has no language of its own to write and a
 * translated label reaches the same category on the way back.
 *
 * Two of them do not survive the return trip, and a write reports each as
 * narrowed rather than this function claiming otherwise. PLOT4ai is written
 * under the model's own category names because Threat Dragon ships an older
 * eight-category set that names something else, so the label reaches the
 * file whole but reads back as a custom category. A custom category whose
 * methodology name is one Threat Dragon enumerates reads back as that
 * methodology rather than as custom. The caller sees both by reading its own
 * projection back with {@link toThreatCategory}.
 *
 * Narrowed rather than unrepresentable is the distinction the divergence
 * vocabulary draws: the category reaches the file whole and comes back
 * holding less, where something unrepresentable never reaches the file at
 * all. A diagram's name, which the format replaces with a number, is the
 * second kind.
 *
 * An Elevation of Privilege threat is the one category written somewhere
 * other than `type`: Threat Dragon's own editor writes the suit to
 * `cardSuit` and leaves `type` null, and the model holds the suit alone.
 */
export function fromThreatCategory(
  category: ThreatCategory,
): ThreatDragonCategoryFields {
  if (category.methodology === 'STRIDE') {
    return { modelType: 'STRIDE', type: strideLabels[category.category] };
  }
  if (category.methodology === 'LINDDUN') {
    return { modelType: 'LINDDUN', type: linddunLabels[category.category] };
  }
  if (category.methodology === 'CIA') {
    return { modelType: 'CIA', type: ciaLabels[category.category] };
  }
  if (category.methodology === 'CIA-DIE') {
    return { modelType: 'CIADIE', type: ciaDieLabels[category.category] };
  }
  if (category.methodology === 'PLOT4ai') {
    return { modelType: 'PLOT4ai', type: category.category };
  }
  return category.methodologyName === eop
    ? { modelType: eop, type: null, cardSuit: category.category }
    : { modelType: category.methodologyName, type: category.category };
}

function custom(methodologyName: string, category: string): CustomCategory {
  return { methodology: 'custom', methodologyName, category };
}

function paired<Methodology extends ThreatCategory['methodology'], Category>(
  methodology: Methodology,
  category: Category | undefined,
): { methodology: Methodology; category: Category } | undefined {
  return category === undefined ? undefined : { methodology, category };
}

function resolve<Category extends string>(
  categories: Readonly<Record<string, Category>>,
  translations: Readonly<Record<string, string>>,
  label: string,
): Category | undefined {
  return lookup(categories, lookup(translations, label) ?? label);
}

function lookup<Value>(
  table: Readonly<Record<string, Value>>,
  key: string,
): Value | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}
