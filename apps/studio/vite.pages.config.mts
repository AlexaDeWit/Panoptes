import { join } from 'node:path';
import { studioConfig } from './vite.config.mjs';

export default studioConfig({
  cacheDirectory: join(
    import.meta.dirname,
    '../../node_modules/.vite/studio-pages',
  ),
  outDirectory: '../studio-e2e/test-output/pages-site',
});
