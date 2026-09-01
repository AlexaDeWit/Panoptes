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
 * A Threat Dragon value as the internal model holds it, and whether the
 * model holds it exactly. `exact` is false where the codec had to fall
 * back, which is a read's cue to report a divergence.
 */
export type Reading<Value> = {
  readonly value: Value;
  readonly exact: boolean;
};

const unspecified = 'unspecified';

const statuses = {
  Open: 'open',
  Mitigated: 'mitigated',
  Transferred: 'transferred',
  Avoided: 'avoided',
  Accepted: 'accepted-risk',
  Eliminated: 'eliminated',
  NotApplicable: 'not-applicable',
} as const satisfies Record<string, ThreatStatus>;

const severities = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
  TBD: 'undecided',
  TBA: 'undecided',
} as const satisfies Record<string, Severity>;

const strideCategories = {
  Spoofing: 'spoofing',
  Tampering: 'tampering',
  Repudiation: 'repudiation',
  'Information disclosure': 'information-disclosure',
  'Denial of service': 'denial-of-service',
  'Elevation of privilege': 'elevation-of-privilege',
} as const satisfies Record<string, StrideCategory['category']>;

const linddunCategories = {
  Linkability: 'linking',
  Identifiability: 'identifying',
  'Non-repudiation': 'non-repudiation',
  Detectability: 'detecting',
  'Disclosure of information': 'data-disclosure',
  Unawareness: 'unawareness',
  'Non-compliance': 'non-compliance',
} as const satisfies Record<string, LinddunCategory['category']>;

const ciaCategories = {
  Confidentiality: 'confidentiality',
  Integrity: 'integrity',
  Availability: 'availability',
} as const satisfies Record<string, CiaCategory['category']>;

const ciaDieCategories = {
  ...ciaCategories,
  Distributed: 'distributed',
  Immutable: 'immutable',
  Ephemeral: 'ephemeral',
} as const satisfies Record<string, CiaDieCategory['category']>;

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
  threat: ThreatDragonThreat,
): Reading<ThreatCategory> {
  const methodology = threat.modelType ?? unspecified;
  if (methodology === 'EOP') {
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
