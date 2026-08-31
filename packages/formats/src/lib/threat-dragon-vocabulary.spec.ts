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
    expect(
      categoriesOf(
        types.map((type) => ({ ...base, modelType: 'STRIDE', type })),
      ),
    ).toEqual(
      [
        'spoofing',
        'tampering',
        'repudiation',
        'information-disclosure',
        'denial-of-service',
        'elevation-of-privilege',
      ].map((category) => ({ methodology: 'STRIDE', category })),
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
    expect(
      categoriesOf(
        types.map((type) => ({ ...base, modelType: 'LINDDUN', type })),
      ),
    ).toEqual(
      [
        'linking',
        'identifying',
        'non-repudiation',
        'detecting',
        'data-disclosure',
        'unawareness',
        'non-compliance',
      ].map((category) => ({ methodology: 'LINDDUN', category })),
    );
  });

  it('maps every CIA category', () => {
    const types = ['Confidentiality', 'Integrity', 'Availability'] as const;
    expect(
      categoriesOf(types.map((type) => ({ ...base, modelType: 'CIA', type }))),
    ).toEqual(
      ['confidentiality', 'integrity', 'availability'].map((category) => ({
        methodology: 'CIA',
        category,
      })),
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
    expect(
      categoriesOf(
        types.map((type) => ({ ...base, modelType: 'CIADIE', type })),
      ),
    ).toEqual(
      [
        'confidentiality',
        'integrity',
        'availability',
        'distributed',
        'immutable',
        'ephemeral',
      ].map((category) => ({ methodology: 'CIA-DIE', category })),
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
