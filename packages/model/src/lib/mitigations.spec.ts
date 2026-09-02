import { mitigationSchema, mitigationStatusSchema } from './mitigations.js';

const consentTag = {
  id: 'dredger-consent-tag',
  title: 'Dredger consent tag and target guard',
  prose:
    'Dredger queries the target CodeArtifact repository for the `Dredger: ' +
    'PermanentDeletionAllowed` resource tag and fails closed without it, ' +
    'and refuses to boot if MIRROR_TARGET == PUBLICATION_TARGET.',
  status: 'proposed',
  threats: [
    '0b32b3e5-74f1-421c-8c9b-92a24fd2a00b',
    'c87367bd-fc3f-4792-94b6-8db459011823',
  ],
};

describe('mitigationStatusSchema', () => {
  it('parses every status', () => {
    for (const status of ['proposed', 'implemented', 'verified']) {
      expect(mitigationStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("rejects 'mitigated'; that word belongs to threat status", () => {
    expect(mitigationStatusSchema.safeParse('mitigated').success).toBe(false);
  });
});

describe('mitigationSchema', () => {
  it('parses a mitigation addressing two threats', () => {
    expect(mitigationSchema.parse(consentTag)).toEqual(consentTag);
  });

  it('accepts a mitigation addressing no threat yet', () => {
    expect(
      mitigationSchema.safeParse({ ...consentTag, threats: [] }).success,
    ).toBe(true);
  });
});
