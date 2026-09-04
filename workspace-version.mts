import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The workspace version: the root manifest's, which `nx release` writes and
 * every project follows under the fixed release group (nx.json, `release`).
 */
export const workspaceVersion = (): string =>
  (
    JSON.parse(
      readFileSync(join(import.meta.dirname, 'package.json'), 'utf8'),
    ) as { version: string }
  ).version;

/**
 * The build-time substitution that stamps the workspace version into the CLI.
 * The esbuild bundle and the test run take it from here, so a compiled binary
 * and a test cannot disagree about which version they carry.
 */
export const versionDefine = (): Record<string, string> => ({
  PANOPTES_VERSION: JSON.stringify(workspaceVersion()),
});
