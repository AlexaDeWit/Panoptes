import { reactApp } from '../../vite.shared.mts';

export default reactApp(import.meta.dirname, {
  setupFiles: ['./src/test-setup.ts'],
});
