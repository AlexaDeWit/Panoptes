import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, test } from 'node:test';

import { Either } from 'effect';

import {
  parseReleaseVersion,
  prepareRelease,
  readWorkspaceVersion,
  tagRelease,
  type CommandResult,
  type ReleaseFailure,
  type RunCommand,
} from './release.mts';

type CommandCall = Readonly<{
  args: string[];
  command: string;
  options: Readonly<{ cwd: string; inherit?: boolean }>;
}>;

const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
const scratch: string[] = [];
afterEach(() => {
  for (const path of scratch.splice(0)) {
    rmSync(path, { force: true, recursive: true });
  }
});

const result = (status = 0, stdout = '', stderr = ''): CommandResult => ({
  status,
  stdout,
  stderr,
});
const key = (command: string, args: string[]): string =>
  [command, ...args].join('\0');

const fakeRunner = (
  overrides: ReadonlyMap<string, CommandResult> = new Map(),
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
      overrides.get(key(command, args)) ??
      defaults.get(key(command, args)) ??
      result()
    );
  };
  return { calls, run };
};

const right = <Value,>(
  outcome: Either.Either<Value, ReleaseFailure>,
): Value => {
  assert.equal(Either.isRight(outcome), true, JSON.stringify(outcome));
  if (Either.isLeft(outcome)) throw new Error(JSON.stringify(outcome.left));
  return outcome.right;
};

const leftText = <Value,>(
  outcome: Either.Either<Value, ReleaseFailure>,
): string => {
  assert.equal(Either.isLeft(outcome), true, JSON.stringify(outcome));
  return Either.isLeft(outcome) ? JSON.stringify(outcome.left) : '';
};

const readVersion = (): Either.Either<string, ReleaseFailure> =>
  Either.right('0.1.0');

const tagOptions = (
  run: RunCommand,
  confirm: (tag: string) => Promise<boolean> = () => Promise.resolve(true),
) => ({
  confirm,
  cwd: '/repo',
  dryRun: false,
  input: 'v0.1.0',
  readVersion,
  run,
  write: () => {},
});

void describe('version input', () => {
  void test('accepts stable versions with an optional prefix', () => {
    assert.deepEqual(right(parseReleaseVersion('0.1.0')), {
      tag: 'v0.1.0',
      version: '0.1.0',
    });
    assert.deepEqual(right(parseReleaseVersion('v10.20.30')), {
      tag: 'v10.20.30',
      version: '10.20.30',
    });
  });

  for (const input of [
    '',
    '0.1',
    '01.2.3',
    'v',
    '0.1.0-rc.1',
    '0.1.0;whoami',
  ]) {
    void test(`rejects ${JSON.stringify(input)}`, () => {
      assert.match(leftText(parseReleaseVersion(input)), /InvalidVersion/u);
    });
  }
});

void test('reads one version from every workspace manifest', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'saerskriven-release-'));
  scratch.push(cwd);
  for (const path of ['apps/cli', 'packages/model']) {
    mkdirSync(join(cwd, path), { recursive: true });
  }
  for (const path of [
    'package.json',
    'apps/cli/package.json',
    'packages/model/package.json',
  ]) {
    writeFileSync(join(cwd, path), '{"version":"0.1.0"}');
  }
  assert.equal(right(readWorkspaceVersion(cwd)), '0.1.0');
  writeFileSync(
    join(cwd, 'packages/model/package.json'),
    '{"version":"0.2.0"}',
  );
  assert.match(
    leftText(readWorkspaceVersion(cwd)),
    /packages[/\\]model[/\\]package.json carries 0.2.0/u,
  );
});

void describe('release preparation', () => {
  void test('writes, formats, and checks the generated release files', () => {
    const { calls, run } = fakeRunner(
      new Map([
        [
          key('git', ['symbolic-ref', '--quiet', '--short', 'HEAD']),
          result(0, 'release-v0.1.0'),
        ],
      ]),
    );
    const message = right(
      prepareRelease({
        cwd: '/repo',
        dryRun: false,
        input: 'v0.1.0',
        readVersion,
        run,
      }),
    );
    assert.match(message, /prepared v0\.1\.0/u);
    assert.deepEqual(
      calls.filter(({ command }) => command === 'pnpm').map(({ args }) => args),
      [
        ['nx', 'release', 'version'],
        ['nx', 'release', 'changelog', '0.1.0'],
        ['exec', 'oxfmt', 'CHANGELOG.md'],
        ['format:check'],
      ],
    );
  });

  void test('dry run asks Nx for the version and changes nothing', () => {
    const { calls, run } = fakeRunner(
      new Map([
        [
          key('git', ['symbolic-ref', '--quiet', '--short', 'HEAD']),
          result(0, 'release-v0.1.0'),
        ],
      ]),
    );
    assert.match(
      right(
        prepareRelease({
          cwd: '/repo',
          dryRun: true,
          input: 'v0.1.0',
          run,
        }),
      ),
      /nothing changed/u,
    );
    assert.deepEqual(
      calls.filter(({ command }) => command === 'pnpm').map(({ args }) => args),
      [['nx', 'release', 'version', '--dry-run']],
    );
  });

  void test('fails closed when git cannot inspect the tree', () => {
    const { run } = fakeRunner(
      new Map([
        [key('git', ['status', '--porcelain']), result(128, '', 'broken')],
      ]),
    );
    assert.match(
      leftText(
        prepareRelease({
          cwd: '/repo',
          dryRun: true,
          input: 'v0.1.0',
          run,
        }),
      ),
      /git status --porcelain/u,
    );
  });
});

void test('the Nx target passes the version only through the environment', () => {
  const injection = spawnSync('pnpm', ['nx', 'run', 'release-tools:prepare'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NX_DAEMON: 'false',
      RELEASE_VERSION: 'not-a-version; exit 0',
    },
  });
  assert.notEqual(injection.status, 0);
  assert.match(
    `${injection.stdout}${injection.stderr}`,
    /not-a-version; exit 0.*not X\.Y\.Z/su,
  );
});

void test('the Nx target does not forward shell arguments', () => {
  const injection = spawnSync(
    'pnpm',
    ['nx', 'run', 'release-tools:prepare', '--args=; exit 0'],
    {
      cwd: workspaceRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        NX_DAEMON: 'false',
        RELEASE_VERSION: 'not-a-version',
      },
    },
  );
  assert.notEqual(injection.status, 0);
  assert.match(
    `${injection.stdout}${injection.stderr}`,
    /not-a-version.*not X\.Y\.Z/su,
  );
});

void describe('tag creation', () => {
  void test('pins the signed tag to the checked commit before pushing', async () => {
    const { calls, run } = fakeRunner();
    assert.match(right(await tagRelease(tagOptions(run))), /pushed v0\.1\.0/u);
    assert.ok(
      calls.some(
        ({ args, command }) =>
          command === 'git' &&
          args.join(' ') === 'tag -s v0.1.0 -m v0.1.0 abc123',
      ),
    );
    assert.ok(
      calls.some(
        ({ args, command }) =>
          command === 'git' && args.join(' ') === 'push origin v0.1.0',
      ),
    );
    assert.ok(!calls.some(({ args }) => args.join(' ') === 'tag -d v0.1.0'));
  });

  void test('dry run never creates a tag', async () => {
    const { calls, run } = fakeRunner();
    const message = right(
      await tagRelease({ ...tagOptions(run), dryRun: true }),
    );
    assert.match(message, /nothing created or pushed/u);
    assert.ok(!calls.some(({ args }) => args[0] === 'tag' && args[1] === '-s'));
  });

  void test('fails closed on a local tag lookup error', async () => {
    const { run } = fakeRunner(
      new Map([
        [
          key('git', ['rev-parse', '-q', '--verify', 'refs/tags/v0.1.0']),
          result(128),
        ],
      ]),
    );
    assert.match(leftText(await tagRelease(tagOptions(run))), /git rev-parse/u);
  });

  void test('refuses a temporary tag bypass', async () => {
    const { run } = fakeRunner(
      new Map([
        [
          key('gh', ['api', 'repos/AlexaDeWit/Saerskriven/rulesets/7']),
          result(
            0,
            '{"enforcement":"active","bypass_actors":[{"actor_id":5}],"current_user_can_bypass":"always","rules":[{"type":"update"},{"type":"deletion"},{"type":"required_signatures"},{"type":"non_fast_forward"}]}',
          ),
        ],
      ]),
    );
    assert.match(
      leftText(await tagRelease(tagOptions(run))),
      /empty bypass list/u,
    );
  });

  void test('refuses a red CI gate', async () => {
    const { run } = fakeRunner(
      new Map([
        [
          key('gh', [
            'api',
            'repos/AlexaDeWit/Saerskriven/commits/abc123/check-runs?per_page=100',
          ]),
          result(
            0,
            '{"check_runs":[{"id":9,"name":"CI gate","status":"completed","conclusion":"failure"}]}',
          ),
        ],
      ]),
    );
    assert.match(
      leftText(await tagRelease(tagOptions(run))),
      /not completed[/]success/u,
    );
  });

  const cleanupCases: Array<
    readonly [string, ReadonlyMap<string, CommandResult>, RegExp]
  > = [
    [
      'signature verification fails',
      new Map([[key('git', ['tag', '-v', 'v0.1.0']), result(1)]]),
      /git tag -v/u,
    ],
    [
      'the tag points elsewhere',
      new Map([
        [key('git', ['rev-parse', 'v0.1.0^{commit}']), result(0, 'def456')],
      ]),
      /not the checked commit/u,
    ],
    [
      'the push fails',
      new Map([[key('git', ['push', 'origin', 'v0.1.0']), result(1)]]),
      /git push/u,
    ],
  ];
  for (const [name, overrides, pattern] of cleanupCases) {
    void test(`removes the local tag when ${name}`, async () => {
      const { calls, run } = fakeRunner(overrides);
      assert.match(leftText(await tagRelease(tagOptions(run))), pattern);
      assert.ok(calls.some(({ args }) => args.join(' ') === 'tag -d v0.1.0'));
    });
  }

  void test('confirmation refusal removes the tag and blocks the push', async () => {
    const { calls, run } = fakeRunner();
    assert.match(
      leftText(await tagRelease(tagOptions(run, () => Promise.resolve(false)))),
      /not confirmed/u,
    );
    assert.ok(calls.some(({ args }) => args.join(' ') === 'tag -d v0.1.0'));
    assert.ok(
      !calls.some(({ args }) => args.join(' ') === 'push origin v0.1.0'),
    );
  });
});
