import { severitySchema, threatSchema, threatStatusSchema } from './threats.js';

const dredgerDeletion = {
  id: '0b32b3e5-74f1-421c-8c9b-92a24fd2a00b',
  number: 102,
  title: 'Accidental permanent deletion of registry data',
  category: { methodology: 'STRIDE', category: 'elevation-of-privilege' },
  severity: 'critical',
  status: 'open',
  description:
    'Dredger issues permanent hard deletions against the mirror registry. ' +
    'Misconfigured, or pointed at the wrong registry, it destroys data ' +
    'permanently.',
  mitigation:
    'Dredger must verify explicit operator consent before it runs any ' +
    'destructive action. It queries the target CodeArtifact repository for ' +
    'a specific resource tag, for example `Dredger: ' +
    'PermanentDeletionAllowed`. Without that tag, Dredger fails closed. It ' +
    'also refuses to boot if MIRROR_TARGET == PUBLICATION_TARGET.',
  elements: ['f66e2ffa-c6bf-4b45-8aad-a23ced3a97ff'],
};

describe('threatStatusSchema', () => {
  it('parses every status', () => {
    for (const status of [
      'open',
      'mitigated',
      'accepted-risk',
      'not-applicable',
    ]) {
      expect(threatStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("rejects Écluse's raw casing; the import maps it", () => {
    expect(threatStatusSchema.safeParse('Open').success).toBe(false);
  });
});

describe('severitySchema', () => {
  it('parses every severity', () => {
    for (const severity of ['low', 'medium', 'high', 'critical', 'undecided']) {
      expect(severitySchema.safeParse(severity).success).toBe(true);
    }
  });
});

describe('threatSchema', () => {
  it('parses an Écluse threat mapped onto the record', () => {
    expect(threatSchema.parse(dredgerDeletion)).toEqual(dredgerDeletion);
  });

  it('attaches one threat to more than one element', () => {
    const shared = {
      ...dredgerDeletion,
      elements: [
        'f66e2ffa-c6bf-4b45-8aad-a23ced3a97ff',
        '0ec10e5e-0000-4000-8000-000000000020',
      ],
    };
    expect(threatSchema.parse(shared)).toEqual(shared);
  });

  it('accepts a threat attached to no element', () => {
    expect(
      threatSchema.safeParse({ ...dredgerDeletion, elements: [] }).success,
    ).toBe(true);
  });

  it('rejects a number that is not a positive integer', () => {
    expect(
      threatSchema.safeParse({ ...dredgerDeletion, number: 0 }).success,
    ).toBe(false);
    expect(
      threatSchema.safeParse({ ...dredgerDeletion, number: 1.5 }).success,
    ).toBe(false);
  });

  it("rejects Threat Dragon's per-threat modelType key; the methodology lives on the category", () => {
    expect(
      threatSchema.safeParse({ ...dredgerDeletion, modelType: 'STRIDE' })
        .success,
    ).toBe(false);
  });
});
