import {
  ciaCategorySchema,
  ciaDieCategorySchema,
  linddunCategorySchema,
  plot4aiCategorySchema,
  severitySchema,
  strideCategorySchema,
  threatCategorySchema,
  threatStatusSchema,
} from '@panoptes/model';
import type { ThreatDragonThreat } from '@panoptes/wire-threat-dragon';
import { equivalent } from './equivalence.js';
import {
  fromSeverity,
  fromThreatCategory,
  fromThreatStatus,
  toSeverity,
  toThreatCategory,
  toThreatStatus,
} from './threat-dragon-vocabulary.js';

const base = {
  id: 'threat-1',
  title: '',
  status: 'Open',
  severity: 'Low',
  description: '',
  mitigation: '',
} as const;

const threat = (part: Partial<ThreatDragonThreat>): ThreatDragonThreat => ({
  ...base,
  ...part,
});

const enumeratedCategories = threatCategorySchema.options.flatMap(
  (option): [string, readonly string[]][] =>
    'options' in option.shape.category
      ? [[option.shape.methodology.value, option.shape.category.options]]
      : [],
);

const written = (methodology: string, category: string) => {
  const held = threatCategorySchema.parse({ methodology, category });
  return equivalent(toThreatCategory(fromThreatCategory(held)).value, held);
};

const unrecovered = enumeratedCategories.flatMap(([methodology, categories]) =>
  categories
    .filter((category) => !written(methodology, category))
    .map((category) => `${methodology}/${category}`),
);

const categoriesUnder = (
  modelType: string,
  types: readonly string[],
): readonly string[] =>
  types.map((type) => {
    const reading = toThreatCategory(threat({ modelType, type }));
    return reading.exact ? reading.value.category : `inexact: ${type}`;
  });

const methodologiesUnder = (
  modelType: string,
  types: readonly string[],
): Set<string> =>
  new Set(
    types.map(
      (type) => toThreatCategory(threat({ modelType, type })).value.methodology,
    ),
  );

describe('toThreatStatus', () => {
  it('maps every status Threat Dragon writes, treatments included', () => {
    const statuses = [
      'Open',
      'Mitigated',
      'Transferred',
      'Avoided',
      'Accepted',
      'Eliminated',
      'NotApplicable',
    ];
    expect(statuses.map((status) => toThreatStatus(status).value)).toEqual([
      'open',
      'mitigated',
      'transferred',
      'avoided',
      'accepted-risk',
      'eliminated',
      'not-applicable',
    ]);
  });

  it('reads a status it does not know as open, and says it was not exact', () => {
    expect(toThreatStatus('Deferred')).toEqual({ value: 'open', exact: false });
  });
});

describe('a vocabulary named for a prototype member', () => {
  it('is a status this codec does not know, not Object.prototype.toString', () => {
    expect(toThreatStatus('toString')).toEqual({ value: 'open', exact: false });
    expect(toThreatStatus('constructor')).toEqual({
      value: 'open',
      exact: false,
    });
  });

  it('is a severity this codec does not know either', () => {
    expect(toSeverity('valueOf')).toEqual({
      value: 'undecided',
      exact: false,
    });
  });

  it('is a methodology and a category this codec does not know', () => {
    expect(
      toThreatCategory(
        threat({ modelType: 'toString', type: 'hasOwnProperty' }),
      ),
    ).toEqual({
      value: {
        methodology: 'custom',
        methodologyName: 'toString',
        category: 'hasOwnProperty',
      },
      exact: true,
    });
    expect(
      toThreatCategory(threat({ modelType: 'STRIDE', type: 'toString' })).value,
    ).toEqual({
      methodology: 'custom',
      methodologyName: 'STRIDE',
      category: 'toString',
    });
  });
});

describe('toSeverity', () => {
  it('maps every severity Threat Dragon offers, TBA among them', () => {
    const severities = ['Low', 'Medium', 'High', 'Critical', 'TBD', 'TBA'];
    expect(severities.map((severity) => toSeverity(severity).value)).toEqual([
      'low',
      'medium',
      'high',
      'critical',
      'undecided',
      'undecided',
    ]);
  });

  it('reads a severity it does not know as undecided, and says so', () => {
    expect(toSeverity('Catastrophic')).toEqual({
      value: 'undecided',
      exact: false,
    });
  });
});

describe('toThreatCategory', () => {
  it('maps every STRIDE category', () => {
    const types = [
      'Spoofing',
      'Tampering',
      'Repudiation',
      'Information disclosure',
      'Denial of service',
      'Elevation of privilege',
    ];
    expect(methodologiesUnder('STRIDE', types)).toEqual(new Set(['STRIDE']));
    expect(categoriesUnder('STRIDE', types)).toEqual(
      strideCategorySchema.shape.category.options,
    );
  });

  it('maps every LINDDUN category, under the names Threat Dragon kept', () => {
    const types = [
      'Linkability',
      'Identifiability',
      'Non-repudiation',
      'Detectability',
      'Disclosure of information',
      'Unawareness',
      'Non-compliance',
    ];
    expect(methodologiesUnder('LINDDUN', types)).toEqual(new Set(['LINDDUN']));
    expect(categoriesUnder('LINDDUN', types)).toEqual(
      linddunCategorySchema.shape.category.options,
    );
  });

  it('maps every CIA category', () => {
    const types = ['Confidentiality', 'Integrity', 'Availability'];
    expect(methodologiesUnder('CIA', types)).toEqual(new Set(['CIA']));
    expect(categoriesUnder('CIA', types)).toEqual(
      ciaCategorySchema.shape.category.options,
    );
  });

  it('maps every CIA-DIE category', () => {
    const types = [
      'Confidentiality',
      'Integrity',
      'Availability',
      'Distributed',
      'Immutable',
      'Ephemeral',
    ];
    expect(methodologiesUnder('CIADIE', types)).toEqual(new Set(['CIA-DIE']));
    expect(categoriesUnder('CIADIE', types)).toEqual(
      ciaDieCategorySchema.shape.category.options,
    );
  });

  it('maps DIE onto CIA-DIE, the set Threat Dragon aliases it to', () => {
    const types = ['Distributed', 'Immutable', 'Ephemeral'];
    expect(methodologiesUnder('DIE', types)).toEqual(new Set(['CIA-DIE']));
    expect(categoriesUnder('DIE', types)).toEqual([
      'distributed',
      'immutable',
      'ephemeral',
    ]);
  });

  it('recovers a category written in the language its author saw', () => {
    expect(
      toThreatCategory(threat({ modelType: 'STRIDE', type: 'Manipulation' })),
    ).toEqual({
      value: { methodology: 'STRIDE', category: 'tampering' },
      exact: true,
    });
    expect(
      toThreatCategory(
        threat({ modelType: 'STRIDE', type: 'Nichtanerkennung' }),
      ).value,
    ).toEqual({ methodology: 'STRIDE', category: 'repudiation' });
    expect(
      toThreatCategory(threat({ modelType: 'CIADIE', type: 'Vertraulichkeit' }))
        .value,
    ).toEqual({ methodology: 'CIA-DIE', category: 'confidentiality' });
    expect(
      toThreatCategory(threat({ modelType: 'CIADIE', type: 'Distribuído' }))
        .value,
    ).toEqual({ methodology: 'CIA-DIE', category: 'distributed' });
  });

  it('falls back to custom for a label no language of its own names', () => {
    expect(
      toThreatCategory(threat({ modelType: 'STRIDE', type: 'Fälschung' })),
    ).toEqual({
      value: {
        methodology: 'custom',
        methodologyName: 'STRIDE',
        category: 'Fälschung',
      },
      exact: false,
    });
  });

  it('carries a methodology the model does not enumerate as custom', () => {
    expect(
      toThreatCategory(
        threat({ modelType: 'PLOT4ai', type: 'Ethics & Human Rights' }),
      ),
    ).toEqual({
      value: {
        methodology: 'custom',
        methodologyName: 'PLOT4ai',
        category: 'Ethics & Human Rights',
      },
      exact: true,
    });
    expect(
      toThreatCategory(threat({ modelType: 'default', type: 'Was auch immer' }))
        .value,
    ).toEqual({
      methodology: 'custom',
      methodologyName: 'default',
      category: 'Was auch immer',
    });
  });

  it('holds the suit of an Elevation of Privilege card and no more', () => {
    expect(
      toThreatCategory(
        threat({
          modelType: 'EOP',
          type: null,
          eopGameId: 'cornucopia',
          cardSuit: 'Data Validation & Encoding',
          cardNumber: '3',
        }),
      ),
    ).toEqual({
      value: {
        methodology: 'custom',
        methodologyName: 'EOP',
        category: 'Data Validation & Encoding',
      },
      exact: false,
    });
  });

  it('names what the file left out rather than holding an empty name', () => {
    expect(toThreatCategory(threat({})).value).toEqual({
      methodology: 'custom',
      methodologyName: 'unspecified',
      category: 'unspecified',
    });
    expect(toThreatCategory(threat({ modelType: 'EOP' })).value).toEqual({
      methodology: 'custom',
      methodologyName: 'EOP',
      category: 'unspecified',
    });
  });
});

describe('writing a vocabulary back out', () => {
  it.each(threatStatusSchema.options)(
    'spells %s so the read recovers it',
    (status) => {
      expect(toThreatStatus(fromThreatStatus(status)).value).toBe(status);
    },
  );

  it.each(severitySchema.options)(
    'spells %s so the read recovers it',
    (severity) => {
      expect(toSeverity(fromSeverity(severity)).value).toBe(severity);
    },
  );

  it('spells the undecided severity TBD, of the two the read takes', () => {
    expect(fromSeverity('undecided')).toBe('TBD');
  });

  it('names every enumerated category but PLOT4ai in labels the read recovers', () => {
    expect(unrecovered).toEqual(
      plot4aiCategorySchema.shape.category.options.map(
        (category) => `PLOT4ai/${category}`,
      ),
    );
  });

  it('writes a PLOT4ai category under the model own name for it', () => {
    expect(
      fromThreatCategory({
        methodology: 'PLOT4ai',
        category: 'cybersecurity',
      }),
    ).toEqual({ modelType: 'PLOT4ai', type: 'cybersecurity' });
  });

  it('writes a custom category under the methodology name it carries', () => {
    expect(
      fromThreatCategory({
        methodology: 'custom',
        methodologyName: 'Process',
        category: 'documentation',
      }),
    ).toEqual({ modelType: 'Process', type: 'documentation' });
  });

  it('writes an Elevation of Privilege suit where that editor reads one', () => {
    expect(
      fromThreatCategory({
        methodology: 'custom',
        methodologyName: 'EOP',
        category: 'Data Validation & Encoding',
      }),
    ).toEqual({
      modelType: 'EOP',
      type: null,
      cardSuit: 'Data Validation & Encoding',
    });
  });

  it('writes CIA-DIE under CIADIE, the name Threat Dragon stores', () => {
    expect(
      fromThreatCategory({ methodology: 'CIA-DIE', category: 'ephemeral' }),
    ).toEqual({ modelType: 'CIADIE', type: 'Ephemeral' });
  });
});
