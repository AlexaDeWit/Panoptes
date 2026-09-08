import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { otmWireSchema } from './otm-wire.js';

it('declares the upstream example, reporting its two undocumented field families separately', () => {
  const given: unknown = JSON.parse(
    readFileSync(
      join(import.meta.dirname, '../../../../test-data/otm/example.json'),
      'utf8',
    ),
  );
  const read = otmWireSchema.parse(given);
  expect(read.otmVersion).toBe('0.2.0');
  expect(read.components).toHaveLength(4);
  expect(read.threats?.[0].risk.impact).toBe(100);
  expect(read.components?.[0].parent).toEqual({
    trustZone: 'internet-trustzone',
  });
});
