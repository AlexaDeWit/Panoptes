import { assumptionSchema, assumptionStatusSchema } from './assumptions.js';

const osvTrusted = {
  id: 'osv-is-trusted',
  prose:
    'Écluse trusts the OSV database as the oracle of vulnerability truth; ' +
    'a hostile oracle defeats the defence outright.',
  status: 'valid',
  threats: ['c87367bd-fc3f-4792-94b6-8db459011823'],
};

describe('assumptionStatusSchema', () => {
  it('parses every status', () => {
    for (const status of ['unconfirmed', 'valid', 'invalidated']) {
      expect(assumptionStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("rejects 'invalid', since the status names the event of invalidation", () => {
    expect(assumptionStatusSchema.safeParse('invalid').success).toBe(false);
  });
});

describe('assumptionSchema', () => {
  it('parses an assumption linked to threats', () => {
    expect(assumptionSchema.parse(osvTrusted)).toEqual(osvTrusted);
  });

  it('accepts an assumption linked to nothing yet', () => {
    expect(
      assumptionSchema.safeParse({ ...osvTrusted, threats: [] }).success,
    ).toBe(true);
  });
});
