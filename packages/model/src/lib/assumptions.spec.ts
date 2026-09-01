import { assumptionSchema, assumptionStatusSchema } from './assumptions.js';

const osvTrusted = {
  id: 'osv-is-trusted',
  prose:
    'Écluse trusts the OSV database as the oracle of vulnerability truth; ' +
    'a hostile oracle defeats the defence outright.',
  status: 'valid',
  elements: ['f1646094-9885-422a-b7e7-7888c72905ef'],
  threats: ['c87367bd-fc3f-4792-94b6-8db459011823'],
};

describe('assumptionStatusSchema', () => {
  it('parses both statuses', () => {
    for (const status of ['valid', 'invalidated']) {
      expect(assumptionStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("rejects 'invalid'; the state is the event of invalidation", () => {
    expect(assumptionStatusSchema.safeParse('invalid').success).toBe(false);
  });
});

describe('assumptionSchema', () => {
  it('parses an assumption linked to elements and threats', () => {
    expect(assumptionSchema.parse(osvTrusted)).toEqual(osvTrusted);
  });

  it('accepts an assumption linked to nothing yet', () => {
    expect(
      assumptionSchema.safeParse({ ...osvTrusted, elements: [], threats: [] })
        .success,
    ).toBe(true);
  });
});
