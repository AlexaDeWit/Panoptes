import { parsedFixture } from './fixtures.js';
import { validModelFixture } from './lib/fixtures.js';

describe('parsedFixture', () => {
  it('returns the model a fixture parses to', () => {
    expect(parsedFixture(validModelFixture).metadata.title).toBe(
      'Order service',
    );
  });

  it('names the path and the reason when a fixture stops parsing', () => {
    expect(() =>
      parsedFixture({ ...validModelFixture, lastIssuedThreatNumber: -1 }),
    ).toThrow('Fixture does not parse: lastIssuedThreatNumber:');
  });
});
