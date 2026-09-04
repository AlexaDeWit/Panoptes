import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cliVersion } from './version.js';

describe('the stamped version', () => {
  it('is the version the root manifest carries', () => {
    const manifest: unknown = JSON.parse(
      readFileSync(
        join(import.meta.dirname, '..', '..', '..', 'package.json'),
        'utf8',
      ),
    );

    expect(manifest).toMatchObject({ version: cliVersion });
  });
});
