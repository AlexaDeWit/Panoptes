import {
  parsedFixture,
  richerThanFormatFixture,
} from './threat-dragon.fixtures.js';

describe('parsedFixture', () => {
  it('returns the model a fixture parses to', () => {
    expect(parsedFixture(richerThanFormatFixture).metadata.title).toBe(
      'Ledger',
    );
  });

  it('names the path and the reason when a fixture stops parsing', () => {
    expect(() =>
      parsedFixture({ ...richerThanFormatFixture, lastIssuedThreatNumber: -1 }),
    ).toThrow('A fixture does not parse: lastIssuedThreatNumber:');
  });
});
