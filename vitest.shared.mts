// Root-defined vitest configuration. A leaf project's vitest.config.mts is one
// line: `export default nodeTest(import.meta.dirname)`. Deviations from the
// shared shape belong here, behind a parameter, not in leaf configs.
import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { versionDefine } from './workspace-version.mts';

const workspaceRoot = import.meta.dirname;

const projectName = (projectRoot: string): string =>
  JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
    .name as string;

export const cacheDir = (projectRoot: string): string =>
  join(
    workspaceRoot,
    'node_modules/.vite',
    relative(workspaceRoot, projectRoot),
  );

export const sharedTest = (
  projectRoot: string,
  environment: 'node' | 'jsdom',
  setupFiles: string[] = [],
) => ({
  name: projectName(projectRoot),
  watch: false,
  globals: true,
  environment,
  include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  // Paths relative to the project root, for the browser APIs jsdom leaves out.
  setupFiles,
  reporters: ['default'],
  coverage: {
    reportsDirectory: join(projectRoot, 'test-output/vitest/coverage'),
    provider: 'v8' as const,
    // lcov for the Codecov upload, text for the terminal.
    reporter: ['text', 'lcov'],
    // A fixture is a spec's input rather than code under test: a model
    // literal no assertion reads is not a coverage hole, and the parse it
    // goes through is exercised by every spec that reads the fixture.
    exclude: [...coverageConfigDefaults.exclude, '**/*.fixtures.ts'],
  },
});

export const nodeTest = (projectRoot: string) =>
  defineConfig({
    root: projectRoot,
    cacheDir: cacheDir(projectRoot),
    // The same substitution the CLI bundle is built with, so a test reads the
    // constant a release ships rather than a value invented for the test.
    define: versionDefine(),
    test: sharedTest(projectRoot, 'node'),
  });
