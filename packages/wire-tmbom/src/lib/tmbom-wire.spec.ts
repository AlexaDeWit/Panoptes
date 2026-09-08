import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmbomWireSchema } from './tmbom-wire.js';

it('declares the complete upstream 1.0.2 example without narrowing or stripping', () => {
  const given: unknown = JSON.parse(
    readFileSync(
      join(import.meta.dirname, '../../../../test-data/tmbom/example.json'),
      'utf8',
    ),
  );
  expect(tmbomWireSchema.parse(given)).toEqual(given);
});
