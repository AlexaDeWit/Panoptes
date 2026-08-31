import {
  ciaCategorySchema,
  ciaDieCategorySchema,
  linddunCategorySchema,
  severitySchema,
  strideCategorySchema,
  threatStatusSchema,
} from '@panoptes/model';
import {
  toSeverity,
  toThreatCategory,
  toThreatStatus,
} from './threat-dragon-vocabulary.js';
import type { ThreatDragonThreat } from './threat-dragon-wire.js';

const base = {
  id: 'threat-1',
  number: 1,
  title: '',
  status: 'Open',
  severity: 'Low',
  description: '',
  mitigation: '',
} as const;

const categoriesOf = (threats: readonly ThreatDragonThreat[]) =>
  threats.map((threat) => toThreatCategory(threat));

const categoryNamesOf = (threats: readonly ThreatDragonThreat[]) =>
  categoriesOf(threats).map((category) => category.category);

const methodologiesOf = (threats: readonly ThreatDragonThreat[]) =>
  new Set(categoriesOf(threats).map((category) => category.methodology));

describe('toThreatStatus', () => {
  it('maps every status Threat Dragon writes', () => {
    const statuses = [
      'NotApplicable',
      'Open',
      'Mitigated',
      'Accepted',
    ] as const;
    expect(statuses.map(toThreatStatus)).toEqual([
      'not-applicable',
      'open',
      'mitigated',
      'accepted-risk',
    ]);
    expect(new Set(statuses.map(toThreatStatus))).toEqual(
      new Set(threatStatusSchema.options),
    );
  });
});

describe('toSeverity', () => {
  it('maps every severity Threat Dragon offers', () => {
    const severities = ['TBD', 'Low', 'Medium', 'High', 'Critical'] as const;
    expect(severities.map(toSeverity)).toEqual([
      'tbd',
      'low',
      'medium',
      'high',
      'critical',
    ]);
    expect(new Set(severities.map(toSeverity))).toEqual(
      new Set(severitySchema.options),
    );
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
    ] as const;
    const threats = types.map((type) => ({
      ...base,
      modelType: 'STRIDE' as const,
      type,
    }));
    expect(methodologiesOf(threats)).toEqual(new Set(['STRIDE']));
    expect(categoryNamesOf(threats)).toEqual(
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
    ] as const;
    const threats = types.map((type) => ({
      ...base,
      modelType: 'LINDDUN' as const,
      type,
    }));
    expect(methodologiesOf(threats)).toEqual(new Set(['LINDDUN']));
    expect(categoryNamesOf(threats)).toEqual(
      linddunCategorySchema.shape.category.options,
    );
  });

  it('maps every CIA category', () => {
    const types = ['Confidentiality', 'Integrity', 'Availability'] as const;
    const threats = types.map((type) => ({
      ...base,
      modelType: 'CIA' as const,
      type,
    }));
    expect(methodologiesOf(threats)).toEqual(new Set(['CIA']));
    expect(categoryNamesOf(threats)).toEqual(
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
    ] as const;
    const threats = types.map((type) => ({
      ...base,
      modelType: 'CIADIE' as const,
      type,
    }));
    expect(methodologiesOf(threats)).toEqual(new Set(['CIA-DIE']));
    expect(categoryNamesOf(threats)).toEqual(
      ciaDieCategorySchema.shape.category.options,
    );
  });

  it('maps DIE onto CIA-DIE, the set Threat Dragon aliases it to', () => {
    const types = ['Distributed', 'Immutable', 'Ephemeral'] as const;
    expect(
      categoriesOf(types.map((type) => ({ ...base, modelType: 'DIE', type }))),
    ).toEqual(
      ['distributed', 'immutable', 'ephemeral'].map((category) => ({
        methodology: 'CIA-DIE',
        category,
      })),
    );
  });

  it('carries every PLOT4ai category as a custom one, unrenamed', () => {
    const types = [
      'Technique & Processes',
      'Accessibility',
      'Identifiability & Linkability',
      'Security',
      'Safety',
      'Unawareness',
      'Ethics & Human Rights',
      'Non-compliance',
    ] as const;
    expect(
      categoriesOf(
        types.map((type) => ({ ...base, modelType: 'PLOT4ai', type })),
      ),
    ).toEqual(
      types.map((category) => ({
        methodology: 'custom',
        methodologyName: 'PLOT4ai',
        category,
      })),
    );
  });

  it('carries a generic threat as a custom one, methodology name and all', () => {
    const methodologies = ['Generic', 'default'] as const;
    expect(
      categoriesOf(
        methodologies.map((modelType) => ({
          ...base,
          modelType,
          type: 'Whatever the author typed',
        })),
      ),
    ).toEqual(
      methodologies.map((methodologyName) => ({
        methodology: 'custom',
        methodologyName,
        category: 'Whatever the author typed',
      })),
    );
  });
});
