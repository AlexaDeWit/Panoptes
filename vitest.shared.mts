// Root-defined vitest configuration. A leaf project's vitest.config.mts is one
// line: `export default nodeTest(import.meta.dirname)`. Deviations from the
// shared shape belong here, behind a parameter, not in leaf configs.
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const workspaceRoot = import.meta.dirname;

const projectName = (projectRoot: string): string =>
  JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
    .name as string;

export const cacheDir = (projectRoot: string): string =>
  join(workspaceRoot, 'node_modules/.vite', relative(workspaceRoot, projectRoot));

export const sharedTest = (
  projectRoot: string,
  environment: 'node' | 'jsdom'
) => ({
  name: projectName(projectRoot),
  watch: false,
  globals: true,
  environment,
  include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  reporters: ['default'],
  coverage: {
    reportsDirectory: join(projectRoot, 'test-output/vitest/coverage'),
    provider: 'v8' as const,
    // lcov for the Codecov upload, text for the terminal.
    reporter: ['text', 'lcov'],
  },
});

export const nodeTest = (projectRoot: string) =>
  defineConfig({
    root: projectRoot,
    cacheDir: cacheDir(projectRoot),
    test: sharedTest(projectRoot, 'node'),
  });
