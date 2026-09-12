import { existsSync } from 'node:fs';
import { bundlePath, compiledRunner } from './runners.fixtures.js';

describe('the CLI as it is packaged', () => {
  it('has a bundle to run, which the build target produced', () => {
    expect(existsSync(bundlePath)).toBe(true);
  });

  it('has the compiled executable wherever the environment demands one', () => {
    expect(
      process.env.SAERSKRIVEN_COMPILED_RUNNER === 'required'
        ? compiledRunner.absence
        : undefined,
    ).toBeUndefined();
  });
});
