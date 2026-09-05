import { nodeTest } from '../../vitest.shared.mts';

// src/ is playwright's testDir, and both runners claim the same spec file
// names, so the specs that need no browser live in tests/ and vitest is
// pointed at that directory alone.
export default nodeTest(import.meta.dirname, {
  include: ['tests/**/*.spec.ts'],
});
