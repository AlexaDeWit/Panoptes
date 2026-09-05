import { nodeTest } from '../../vitest.shared.mts';

export default nodeTest(import.meta.dirname, {
  include: ['tests/**/*.{test,spec}.ts'],
});
