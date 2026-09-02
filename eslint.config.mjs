import nx from '@nx/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

// Boundary host, not a linter: the one rule that enforces the layer matrix
// the projects' `layer:` tags declare. Lint rules live in oxlint
// (.oxlintrc.json). The parser runs on syntax alone (no parserOptions
// project), so no type program is built and the checker API stays unused.
export default [
  { ignores: ['**/dist/**', '**/test-output/**', '.nx/**'] },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.mts',
      '**/*.cts',
      '**/*.js',
      '**/*.jsx',
      '**/*.mjs',
      '**/*.cjs',
    ],
    plugins: { '@nx': nx },
    languageOptions: {
      parser: tsParser,
      sourceType: 'module',
    },
    rules: {
      // The dependency matrix, defined once. Source and target layers come
      // from each project's tags, so a new project joins the matrix by
      // declaring its layer, not by editing this file.
      '@nx/enforce-module-boundaries': [
        'error',
        {
          // Project config files compose the shared vite and vitest bases
          // from the workspace root. Tooling wiring, not a layer crossing.
          allow: ['../../vite.shared.mts', '../../vitest.shared.mts'],
          depConstraints: [
            {
              sourceTag: 'layer:model',
              onlyDependOnLibsWithTags: [],
              // The domain layer stays framework-free. Extend the list when
              // a new framework needs banning, in a reviewed PR.
              bannedExternalImports: ['react', 'react-dom'],
            },
            {
              // A wire schema is a contract with files in the wild, so it
              // is built out of zod alone: an internal package it could
              // reuse would turn its own change into a silent format
              // change. The empty list is the rule (issue #91).
              sourceTag: 'layer:wire',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'layer:formats',
              onlyDependOnLibsWithTags: ['layer:model', 'layer:wire'],
            },
            {
              sourceTag: 'layer:canvas',
              onlyDependOnLibsWithTags: ['layer:model'],
            },
            {
              sourceTag: 'layer:render',
              onlyDependOnLibsWithTags: ['layer:model', 'layer:canvas'],
            },
            {
              sourceTag: 'layer:app',
              onlyDependOnLibsWithTags: [
                'layer:model',
                'layer:formats',
                'layer:canvas',
                'layer:render',
              ],
            },
          ],
        },
      ],
    },
  },
];
