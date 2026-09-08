import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';
import { parse } from 'yaml';
import { z } from 'zod';

const root = fileURLToPath(new URL('../../', import.meta.url));
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const commit = 'a'.repeat(40);
const repository = 'example/studio';
const scenario = () => ({
  release: { tag_name: 'v1.2.3', draft: false, prerelease: false },
  commit,
  run: {
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    path: '.github/workflows/ci.yml',
    head_branch: 'v1.2.3',
    head_sha: commit,
    repository: { full_name: repository },
  },
  metadata: { tag: 'v1.2.3', version: '1.2.3', commit, repository, run_id: 42 },
  invalidAttestation: false,
  missingAsset: false,
  apiFailure: false,
  pendingRunChecks: 0,
  liveTag: 'v1.2.3',
});

const fixture = (state = scenario()) => {
  const directory = mkdtempSync(join(tmpdir(), 'studio-pages-'));
  directories.push(directory);
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  const stateFile = join(directory, 'state.json');
  writeFileSync(stateFile, JSON.stringify(state));
  const log = join(directory, 'calls.jsonl');
  writeFileSync(log, '');
  writeFileSync(
    join(bin, 'gh'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const state = JSON.parse(fs.readFileSync(process.env.PAGES_TEST_STATE, 'utf8'));
const args = process.argv.slice(2);
fs.appendFileSync(process.env.PAGES_TEST_LOG, JSON.stringify(args) + '\\n');
if (args[0] === 'api') {
  if (state.apiFailure) process.exit(1);
  const endpoint = args[1];
  if (endpoint.endsWith('/releases/latest')) console.log(JSON.stringify(state.release));
  else if (endpoint.includes('/git/ref/tags/')) console.log('b'.repeat(40));
  else if (endpoint.includes('/git/tags/')) console.log(state.commit);
  else if (endpoint.includes('/actions/runs/')) {
    const status = state.pendingRunChecks > 0 ? 'in_progress' : state.run.status;
    state.pendingRunChecks -= 1;
    fs.writeFileSync(process.env.PAGES_TEST_STATE, JSON.stringify(state));
    console.log(JSON.stringify({ ...state.run, status }));
  }
  else process.exit(2);
} else if (args[0] === 'release' && args[1] === 'download') {
  if (state.missingAsset) process.exit(1);
  const directory = args[args.indexOf('--dir') + 1];
  fs.writeFileSync(path.join(directory, 'studio.tar'), 'opaque website archive');
  fs.writeFileSync(path.join(directory, 'studio-release.json'), JSON.stringify(state.metadata));
} else if (args[0] === 'attestation' && args[1] === 'verify') {
  if (state.invalidAttestation) process.exit(1);
} else process.exit(2);
`,
    { mode: 0o755 },
  );
  writeFileSync(join(bin, 'sleep'), '#!/usr/bin/env bash\nexit 0\n', {
    mode: 0o755,
  });
  writeFileSync(
    join(bin, 'curl'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const state = JSON.parse(fs.readFileSync(process.env.PAGES_TEST_STATE, 'utf8'));
console.log(JSON.stringify({ tag: state.liveTag, version: state.liveTag.slice(1) }));
`,
    { mode: 0o755 },
  );
  const output = join(directory, 'output');
  writeFileSync(output, '');
  return {
    directory,
    calls: () =>
      readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => z.array(z.string()).parse(JSON.parse(line))),
    output: () => readFileSync(output, 'utf8'),
    run: (mode: string, env: Record<string, string> = {}) =>
      spawnSync('bash', [join(root, 'scripts/release/pages.sh'), mode], {
        cwd: directory,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env['PATH'] ?? ''}`,
          GH_REPO: repository,
          GITHUB_OUTPUT: output,
          PAGES_TEST_STATE: stateFile,
          PAGES_TEST_LOG: log,
          ...env,
        },
      }),
  };
};

void test('promotion verifies release assets against the tag commit and successful CI', () => {
  const probe = fixture();
  const result = probe.run('resolve');
  assert.equal(result.status, 0, result.stderr);
  assert.match(probe.output(), /tag=v1\.2\.3/u);
  assert.equal(
    readFileSync(join(probe.directory, 'release-site/artifact.tar'), 'utf8'),
    'opaque website archive',
  );
  const verifications = probe
    .calls()
    .filter(([command]) => command === 'attestation');
  assert.equal(verifications.length, 2);
  for (const call of verifications) {
    assert.equal(call[call.indexOf('--source-digest') + 1], commit);
    assert.equal(call[call.indexOf('--source-ref') + 1], 'refs/tags/v1.2.3');
    assert.equal(
      call[call.indexOf('--signer-workflow') + 1],
      `${repository}/.github/workflows/ci.yml`,
    );
  }
});

void test('manual retry downloads the same released bytes without running a build', () => {
  const probe = fixture();
  assert.equal(probe.run('resolve').status, 0);
  assert.ok(probe.calls().some(([command]) => command === 'release'));
  assert.match(probe.output(), /tag=v1\.2\.3/u);
});

for (const failure of [
  'draft',
  'prerelease',
  'invalid-tag',
  'metadata',
  'version',
  'failed-ci',
  'wrong-workflow',
  'wrong-event',
  'wrong-repository',
  'attestation',
  'missing-asset',
  'api',
] as const) {
  void test(`promotion refuses ${failure}`, () => {
    const state = scenario();
    switch (failure) {
      case 'draft':
        state.release.draft = true;
        break;
      case 'prerelease':
        state.release.prerelease = true;
        break;
      case 'invalid-tag':
        state.release.tag_name = 'v1.2.3-beta.1';
        break;
      case 'metadata':
        state.metadata.commit = 'c'.repeat(40);
        break;
      case 'version':
        state.metadata.version = '1.2.2';
        break;
      case 'failed-ci':
        state.run.conclusion = 'failure';
        break;
      case 'wrong-workflow':
        state.run.path = '.github/workflows/other.yml';
        break;
      case 'wrong-event':
        state.run.event = 'pull_request';
        break;
      case 'wrong-repository':
        state.run.repository.full_name = 'someone/fork';
        break;
      case 'attestation':
        state.invalidAttestation = true;
        break;
      case 'missing-asset':
        state.missingAsset = true;
        break;
      case 'api':
        state.apiFailure = true;
        break;
    }
    const probe = fixture(state);
    assert.notEqual(probe.run('resolve').status, 0);
    assert.equal(probe.output(), '');
  });
}

void test('an older CI run cannot supply the archive for Latest', () => {
  const state = scenario();
  state.run.head_sha = 'c'.repeat(40);
  const probe = fixture(state);
  assert.notEqual(probe.run('resolve').status, 0);
  assert.equal(probe.output(), '');
});

void test('the deployment check rejects a release changed during preparation or approval', () => {
  const probe = fixture();
  assert.equal(
    probe.run('check', { EXPECTED_TAG: 'v1.2.3', EXPECTED_COMMIT: commit })
      .status,
    0,
  );
  assert.notEqual(
    probe.run('check', { EXPECTED_TAG: 'v1.2.2', EXPECTED_COMMIT: commit })
      .status,
    0,
  );
  assert.notEqual(
    probe.run('check', {
      EXPECTED_TAG: 'v1.2.3',
      EXPECTED_COMMIT: 'c'.repeat(40),
    }).status,
    0,
  );
});

void test('packaging checks every manifest and the built stamp before making the archive', () => {
  const probe = fixture();
  for (const directory of [
    'apps/studio/dist',
    'packages/model',
    'scripts/release',
  ])
    mkdirSync(join(probe.directory, directory), { recursive: true });
  symlinkSync(
    join(root, 'scripts/release/release.mts'),
    join(probe.directory, 'scripts/release/release.mts'),
  );
  symlinkSync(
    join(root, 'node_modules'),
    join(probe.directory, 'node_modules'),
  );
  for (const file of [
    'package.json',
    'apps/studio/package.json',
    'packages/model/package.json',
  ])
    writeFileSync(
      join(probe.directory, file),
      JSON.stringify({ version: '1.2.3' }),
    );
  const stamp = join(probe.directory, 'apps/studio/dist/version.json');
  writeFileSync(stamp, JSON.stringify({ version: '1.2.3', tag: 'v1.2.3' }));
  const env = {
    SAERSKRIVEN_RELEASE_TAG: 'v1.2.3',
    GITHUB_SHA: commit,
    GITHUB_RUN_ID: '42',
  };
  const result = probe.run('prepare', env);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    z
      .object({ commit: z.string() })
      .parse(
        JSON.parse(
          readFileSync(
            join(probe.directory, 'release-site/studio-release.json'),
            'utf8',
          ),
        ),
      ).commit,
    commit,
  );
  assert.match(
    spawnSync(
      'tar',
      ['-tf', join(probe.directory, 'release-site/studio.tar')],
      { encoding: 'utf8' },
    ).stdout,
    /version\.json/u,
  );
  assert.notEqual(
    probe.run('prepare', { ...env, SAERSKRIVEN_RELEASE_TAG: 'v1.2.2' }).status,
    0,
  );
  writeFileSync(stamp, JSON.stringify({ version: '1.2.2', tag: 'v1.2.2' }));
  assert.notEqual(probe.run('prepare', env).status, 0);
  writeFileSync(
    join(probe.directory, 'packages/model/package.json'),
    JSON.stringify({ version: '1.2.2' }),
  );
  assert.notEqual(probe.run('prepare', env).status, 0);
});

void test('promotion waits for the dispatching run to finish and rejects a run that stays pending', () => {
  const state = scenario();
  state.pendingRunChecks = 2;
  assert.equal(fixture(state).run('resolve').status, 0);
  state.pendingRunChecks = 100;
  assert.notEqual(fixture(state).run('resolve').status, 0);
});

void test('the public-site check accepts the promoted version and refuses a stale response', () => {
  const env = {
    SITE_URL: 'https://example.test/studio/',
    EXPECTED_TAG: 'v1.2.3',
  };
  assert.equal(fixture().run('verify-live', env).status, 0);
  const state = scenario();
  state.liveTag = 'v1.2.2';
  assert.notEqual(fixture(state).run('verify-live', env).status, 0);
});

const jobSchema = z.object({
  needs: z.union([z.string(), z.array(z.string())]).optional(),
  if: z.string().optional(),
  steps: z
    .array(
      z.object({
        name: z.string(),
        run: z.string().optional(),
        uses: z.string().optional(),
      }),
    )
    .optional(),
});
const workflowSchema = z.object({
  on: z.record(z.string(), z.unknown()),
  concurrency: z.object({
    group: z.string(),
    'cancel-in-progress': z.union([z.string(), z.boolean()]),
  }),
  jobs: z.record(z.string(), jobSchema),
});
const workflow = (name: string) =>
  workflowSchema.parse(
    parse(readFileSync(join(root, '.github/workflows', name), 'utf8')),
  );

void test('publication waits for the gate, prepared website, and attestation', () => {
  const ci = workflow('ci.yml');
  assert.equal(ci.jobs['pages-build']?.needs, 'gate');
  assert.deepEqual(ci.jobs['attest']?.needs, ['gate', 'pages-build']);
  assert.deepEqual(ci.jobs['publish']?.needs, [
    'gate',
    'attest',
    'pages-build',
  ]);
  assert.match(ci.jobs['publish']?.if ?? '', /github\.event_name == 'push'/u);
  const pages = workflow('pages.yml');
  assert.deepEqual(Object.keys(pages.on).toSorted(), ['workflow_dispatch']);
  assert.equal(pages.concurrency.group, 'github-pages');
  assert.equal(pages.concurrency['cancel-in-progress'], false);
  assert.match(
    pages.jobs['prepare']?.if ?? '',
    /github\.ref == 'refs\/heads\/main'/u,
  );
  assert.equal(pages.jobs['deploy']?.needs, 'prepare');
  const steps = pages.jobs['deploy']?.steps ?? [];
  assert.ok(
    steps.findIndex(({ run }) => run?.endsWith('pages.sh check')) <
      steps.findIndex(({ uses }) => uses?.startsWith('actions/deploy-pages@')),
  );
});
