import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach } from 'node:test';
import { Either } from 'effect';
import type {
  CommandResult,
  ReleaseFailure,
  RunCommand,
} from './release-io.mts';

type CommandCall = Readonly<{
  args: string[];
  command: string;
  options: Readonly<{ cwd: string; inherit?: boolean }>;
}>;

/** Repository containing the release tooling. */
export const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
const scratch: string[] = [];
afterEach(() => {
  for (const path of scratch.splice(0)) {
    rmSync(path, { force: true, recursive: true });
  }
});

/** Command output for a release-runner fixture. */
export const result = (
  status = 0,
  stdout = '',
  stderr = '',
): CommandResult => ({
  status,
  stdout,
  stderr,
});
/** Exact command identity for response overrides. */
export const key = (command: string, args: string[]): string =>
  [command, ...args].join('\0');

/** Records release commands and supplies controlled responses. */
export const fakeRunner = (
  overrides: ReadonlyMap<string, CommandResult> = new Map(),
  respond?: (call: CommandCall) => CommandResult | undefined,
): Readonly<{ calls: CommandCall[]; run: RunCommand }> => {
  const calls: CommandCall[] = [];
  const defaults = new Map<string, CommandResult>([
    [key('git', ['status', '--porcelain']), result()],
    [
      key('git', ['symbolic-ref', '--quiet', '--short', 'HEAD']),
      result(0, 'main'),
    ],
    [key('git', ['fetch', '--quiet', 'origin', 'main']), result()],
    [key('git', ['rev-parse', 'HEAD']), result(0, 'abc123')],
    [key('git', ['rev-parse', 'origin/main']), result(0, 'abc123')],
    [
      key('git', ['remote', 'get-url', 'origin']),
      result(0, 'git@github.com:AlexaDeWit/Panoptes.git'),
    ],
    [
      key('gh', ['api', 'repos/AlexaDeWit/Panoptes']),
      result(0, '{"full_name":"AlexaDeWit/Saerskriven"}'),
    ],
    [
      key('gh', ['api', 'repos/AlexaDeWit/Saerskriven/rulesets']),
      result(
        0,
        '[{"id":7,"name":"Tag Integrity","target":"tag","enforcement":"active"}]',
      ),
    ],
    [
      key('gh', ['api', 'repos/AlexaDeWit/Saerskriven/rulesets/7']),
      result(
        0,
        '{"enforcement":"active","bypass_actors":[],"current_user_can_bypass":"never","rules":[{"type":"update"},{"type":"deletion"},{"type":"required_signatures"},{"type":"non_fast_forward"}]}',
      ),
    ],
    [
      key('gh', [
        'api',
        'repos/AlexaDeWit/Saerskriven/commits/abc123/check-runs?per_page=100',
      ]),
      result(
        0,
        '{"check_runs":[{"id":9,"name":"CI gate","status":"completed","conclusion":"success"}]}',
      ),
    ],
    [
      key('gh', [
        'api',
        'repos/AlexaDeWit/Saerskriven/commits/abc123/status?per_page=100',
      ]),
      result(
        0,
        '{"statuses":[{"id":10,"context":"codecov/project","state":"success"}]}',
      ),
    ],
    [
      key('git', ['rev-parse', '-q', '--verify', 'refs/tags/v0.1.0']),
      result(1),
    ],
    [
      key('git', [
        'ls-remote',
        '--exit-code',
        '--tags',
        'origin',
        'refs/tags/v0.1.0',
      ]),
      result(2),
    ],
    [key('/repo/scripts/check-provenance.mjs', []), result()],
    [
      key('git', ['log', '-1', '--format=%s', 'abc123']),
      result(0, 'chore(release): v0.1.0'),
    ],
    [key('git', ['tag', '-s', 'v0.1.0', '-m', 'v0.1.0', 'abc123']), result()],
    [key('git', ['tag', '-v', 'v0.1.0']), result()],
    [key('git', ['rev-parse', 'v0.1.0^{commit}']), result(0, 'abc123')],
    [key('git', ['push', 'origin', 'v0.1.0']), result()],
    [key('git', ['tag', '-d', 'v0.1.0']), result()],
  ]);
  const run: RunCommand = (command, args, options) => {
    calls.push({ args, command, options });
    return (
      respond?.({ command, args, options }) ??
      overrides.get(key(command, args)) ??
      defaults.get(key(command, args)) ??
      result()
    );
  };
  return { calls, run };
};

/** Require a successful release result. */
export const right = <Value,>(
  outcome: Either.Either<Value, ReleaseFailure>,
): Value => {
  assert.equal(Either.isRight(outcome), true, JSON.stringify(outcome));
  if (Either.isLeft(outcome)) throw new Error(JSON.stringify(outcome.left));
  return outcome.right;
};

/** Require a release failure and return its plain data. */
export const leftText = <Value,>(
  outcome: Either.Either<Value, ReleaseFailure>,
): string => {
  assert.equal(Either.isLeft(outcome), true, JSON.stringify(outcome));
  return Either.isLeft(outcome) ? JSON.stringify(outcome.left) : '';
};

/** Create an isolated workspace removed after the test. */
export const temporaryWorkspace = (): string => {
  const cwd = mkdtempSync(join(tmpdir(), 'saerskriven-release-'));
  scratch.push(cwd);
  return cwd;
};
