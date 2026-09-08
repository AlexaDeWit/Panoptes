import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The root manifest version shared by every workspace project. */
export const workspaceVersion = (): string =>
  (
    JSON.parse(
      readFileSync(join(import.meta.dirname, 'package.json'), 'utf8'),
    ) as { version: string }
  ).version;

/** Build-time version substitution for the CLI and studio. */
export const versionDefine = (): Record<string, string> => ({
  SAERSKRIVEN_VERSION: JSON.stringify(workspaceVersion()),
});
