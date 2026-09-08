import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';

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
import {
  fakeRunner,
  key,
  leftText,
  result,
  right,
  temporaryWorkspace,
  workspaceRoot,
} from './release.fixtures.mts';

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
  const cwd = temporaryWorkspace();
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

  void test('the release guard does not query external commit statuses', async () => {
    const { calls, run } = fakeRunner(new Map(), ({ command, args }) =>
      command === 'gh' && args[1]?.includes('/status?')
        ? result(1, '', 'external status service unavailable')
        : undefined,
    );
    const messages: string[] = [];
    right(
      await tagRelease({
        ...tagOptions(run),
        dryRun: true,
        write: (message) => {
          messages.push(message);
        },
      }),
    );
    assert.equal(
      calls.some(({ args }) => args.some((arg) => arg.includes('/status?'))),
      false,
    );
    assert.match(messages.join(''), /CI gate\s+completed\/success/u);
    assert.doesNotMatch(messages.join(''), /Codecov/u);
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

  for (const [name, checks] of [
    ['absent', []],
    [
      'running',
      [{ id: 9, name: 'CI gate', status: 'in_progress', conclusion: null }],
    ],
    [
      'failed',
      [{ id: 9, name: 'CI gate', status: 'completed', conclusion: 'failure' }],
    ],
    [
      'newer failure',
      [
        { id: 8, name: 'CI gate', status: 'completed', conclusion: 'success' },
        { id: 9, name: 'CI gate', status: 'completed', conclusion: 'failure' },
      ],
    ],
  ] as const) {
    void test(`blocks tag creation: ${name} CI gate`, async () => {
      const { calls, run } = fakeRunner(
        new Map([
          [
            key('gh', [
              'api',
              'repos/AlexaDeWit/Saerskriven/commits/abc123/check-runs?per_page=100',
            ]),
            result(0, JSON.stringify({ check_runs: checks })),
          ],
        ]),
      );
      assert.match(
        leftText(await tagRelease(tagOptions(run))),
        /not completed[/]success/u,
      );
      assert.equal(
        calls.some(({ args }) => args[0] === 'tag' && args[1] === '-s'),
        false,
      );
    });
  }

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
