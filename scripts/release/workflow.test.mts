import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parse } from 'yaml';
import { z } from 'zod';

const root = fileURLToPath(new URL('../../', import.meta.url));

const concurrencySchema = z.object({
  group: z.string(),
  'cancel-in-progress': z.union([z.string(), z.boolean()]),
});
const jobSchema = z.object({
  name: z.string(),
  concurrency: concurrencySchema.optional(),
  needs: z.union([z.string(), z.array(z.string())]).optional(),
  if: z.string().optional(),
  outputs: z.record(z.string(), z.string()).optional(),
  permissions: z.record(z.string(), z.string()).optional(),
  steps: z
    .array(
      z.object({
        name: z.string(),
        run: z.string().optional(),
        uses: z.string().optional(),
        if: z.string().optional(),
        env: z.record(z.string(), z.string()).optional(),
      }),
    )
    .optional(),
});
const workflowSchema = z.object({
  on: z.record(z.string(), z.unknown()),
  concurrency: concurrencySchema,
  jobs: z.record(z.string(), jobSchema),
});
const workflow = (name: string) =>
  workflowSchema.parse(
    parse(readFileSync(join(root, '.github/workflows', name), 'utf8')),
  );

void test('publication waits for the gate, prepared website, and attestation', () => {
  const ci = workflow('ci.yml');
  assert.equal(ci.jobs['pages-build']?.needs, 'checks');
  assert.deepEqual(ci.jobs['attest']?.needs, ['checks', 'pages-build']);
  assert.deepEqual(ci.jobs['gate']?.needs, ['checks', 'pages-build', 'attest']);
  assert.deepEqual(ci.jobs['publish']?.needs, [
    'gate',
    'attest',
    'pages-build',
  ]);
  assert.equal(
    ci.jobs['publish']?.if?.trim().replace(/\s+/gu, ' '),
    "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')",
  );
  assert.equal(existsSync(join(root, '.github/workflows/pages.yml')), false);
  assert.ok('workflow_dispatch' in ci.on);
  for (const job of [
    'build-test',
    'static-checks',
    'e2e-smoke',
    'dependency-changes',
    'provenance',
    'checks',
    'pages-build',
    'attest',
    'gate',
  ]) {
    assert.match(ci.jobs[job]?.if ?? '', /!inputs\.deploy_pages/u);
  }
  assert.equal(
    ci.jobs['gate']?.name,
    "${{ inputs.deploy_pages && 'Deployment retry (no CI gate)' || 'CI gate' }}",
  );
  assert.equal(ci.jobs['pages-prepare']?.needs, 'publish');
  assert.match(
    ci.jobs['pages-prepare']?.if ?? '',
    /needs\.publish\.result == 'success'/u,
  );
  assert.match(ci.jobs['pages-prepare']?.if ?? '', /inputs\.deploy_pages/u);
  assert.match(
    ci.jobs['pages-prepare']?.if ?? '',
    /github\.ref == 'refs\/heads\/main'/u,
  );
  assert.equal(ci.jobs['pages-deploy']?.needs, 'pages-prepare');
  assert.deepEqual(ci.jobs['pages-deploy']?.concurrency, {
    group: 'github-pages',
    'cancel-in-progress': false,
  });
  const steps = ci.jobs['pages-deploy']?.steps ?? [];
  assert.ok(
    steps.findIndex(({ run }) => run?.endsWith('pages.sh check')) <
      steps.findIndex(({ uses }) => uses?.startsWith('actions/deploy-pages@')),
  );
});

void test('every check run builds the full release artifacts before signing', () => {
  const ci = workflow('ci.yml');
  const steps = ci.jobs['build-test']?.steps ?? [];
  const compile = steps.find(({ run }) =>
    run?.includes('compile @saerskriven/cli --configuration=all'),
  );
  const compiledTests = steps.find(({ run }) =>
    run?.includes('test-compiled @saerskriven/cli'),
  );
  const upload = steps.find(({ uses }) =>
    uses?.startsWith('actions/upload-artifact@'),
  );
  assert.ok(compile);
  assert.ok(compiledTests);
  assert.ok(upload);
  assert.equal(compile.if, undefined);
  assert.equal(compiledTests.if, undefined);
  assert.equal(upload.if, undefined);
  assert.ok(steps.indexOf(compiledTests) < steps.indexOf(compile));
  assert.ok(steps.indexOf(compile) < steps.indexOf(upload));
  assert.equal(
    ci.jobs['pages-build']?.if?.trim(),
    "!cancelled() && !inputs.deploy_pages && needs.checks.result == 'success'",
  );
  const website = ci.jobs['pages-build']?.steps?.find(({ run }) =>
    run?.includes('pages.sh prepare'),
  );
  assert.ok(website?.run?.includes('pnpm nx build @saerskriven/studio'));
});

void test('only tokens that can sign reach the attestation job', () => {
  const ci = workflow('ci.yml');
  assert.equal(
    ci.jobs['checks']?.outputs?.['attestation'],
    "${{ github.actor != 'dependabot[bot]' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) }}",
  );
  assert.equal(
    ci.jobs['attest']?.if?.trim().replace(/\s+/gu, ' '),
    "!cancelled() && !inputs.deploy_pages && needs.checks.result == 'success' && needs.pages-build.result == 'success' && needs.checks.outputs.attestation == 'true'",
  );
  assert.deepEqual(ci.jobs['attest']?.permissions, {
    contents: 'read',
    'id-token': 'write',
    attestations: 'write',
  });
  const steps = ci.jobs['attest']?.steps ?? [];
  assert.ok(
    steps.every(
      ({ uses, run }) =>
        !uses?.startsWith('actions/checkout@') &&
        !run?.includes('pnpm install'),
    ),
  );
  const verification = steps.find(({ run }) =>
    run?.includes('gh attestation verify'),
  );
  assert.ok(verification?.run);
  for (const argument of [
    '--signer-workflow',
    '--source-ref "$GITHUB_REF"',
    '--source-digest "$GITHUB_SHA"',
  ]) {
    assert.ok(verification.run.includes(argument));
  }
});

const verdict = (job: string, env: Record<string, string>) => {
  const script = workflow('ci.yml').jobs[job]?.steps?.[0]?.run;
  assert.ok(script);
  return spawnSync('bash', ['-euo', 'pipefail', '-c', script], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
};

void test('the final gate permits only successful rehearsals and the token exception', () => {
  const passing = {
    CHECKS: 'success',
    PAGES_BUILD: 'success',
    ATTEST: 'success',
    ATTESTATION_REQUIRED: 'true',
  };
  assert.equal(verdict('gate', passing).status, 0);
  assert.equal(
    verdict('gate', {
      ...passing,
      ATTEST: 'skipped',
      ATTESTATION_REQUIRED: 'false',
    }).status,
    0,
  );
  for (const name of ['CHECKS', 'PAGES_BUILD', 'ATTEST']) {
    for (const state of ['failure', 'cancelled', 'skipped', '']) {
      assert.notEqual(
        verdict('gate', { ...passing, [name]: state }).status,
        0,
        `${name}: ${state}`,
      );
    }
  }
  for (const state of ['failure', 'cancelled', 'success', '']) {
    assert.notEqual(
      verdict('gate', {
        ...passing,
        ATTEST: state,
        ATTESTATION_REQUIRED: 'false',
      }).status,
      0,
    );
  }
  assert.notEqual(
    verdict('gate', { ...passing, ATTESTATION_REQUIRED: '' }).status,
    0,
  );
});

void test('source checks accept a provenance skip only on a PR with unchanged dependencies', () => {
  const passing = {
    EVENT_NAME: 'pull_request',
    BUILD_TEST: 'success',
    STATIC_CHECKS: 'success',
    E2E_SMOKE: 'success',
    DEPENDENCY_CHANGES: 'success',
    LOCKFILE_CHANGED: 'false',
    PROVENANCE: 'skipped',
  };
  assert.equal(verdict('checks', passing).status, 0);
  for (const name of [
    'BUILD_TEST',
    'STATIC_CHECKS',
    'E2E_SMOKE',
    'DEPENDENCY_CHANGES',
  ]) {
    assert.notEqual(
      verdict('checks', { ...passing, [name]: 'failure' }).status,
      0,
    );
  }
  assert.notEqual(
    verdict('checks', { ...passing, LOCKFILE_CHANGED: 'true' }).status,
    0,
  );
  for (const event of ['push', 'workflow_dispatch']) {
    assert.notEqual(
      verdict('checks', { ...passing, EVENT_NAME: event }).status,
      0,
    );
    assert.equal(
      verdict('checks', {
        ...passing,
        EVENT_NAME: event,
        PROVENANCE: 'success',
      }).status,
      0,
    );
  }
});

void test('artifact validation rejects a wrong tag and a corrupted executable', (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'release-artifacts-'));
  context.after(() => {
    rmSync(directory, { recursive: true, force: true });
  });
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({ version: '1.2.3' }),
  );
  mkdirSync(join(directory, 'dist/cli'), { recursive: true });
  const executable = 'saerskriven-1.2.3-x86_64-unknown-linux-gnu';
  const binary = '#!/usr/bin/env bash\necho 1.2.3\n';
  writeFileSync(join(directory, 'dist/cli', executable), binary, {
    mode: 0o755,
  });
  writeFileSync(
    join(directory, 'dist/cli/SHA256SUMS'),
    `${createHash('sha256').update(binary).digest('hex')}  ${executable}\n`,
  );
  const script = workflow('ci.yml').jobs['build-test']?.steps?.find(({ run }) =>
    run?.includes('sha256sum --check'),
  )?.run;
  assert.ok(script);
  for (const [tag, passes] of [
    ['', true],
    ['v1.2.3', true],
    ['v9.9.9', false],
  ] as const) {
    const result: SpawnSyncReturns<string> = spawnSync(
      'bash',
      ['-euo', 'pipefail', '-c', script],
      {
        cwd: directory,
        env: { ...process.env, TAG: tag },
        encoding: 'utf8',
      },
    );
    assert.equal(result.status === 0, passes, result.stderr);
  }
  writeFileSync(
    join(directory, 'dist/cli', executable),
    `${binary}# changed\n`,
  );
  assert.notEqual(
    spawnSync('bash', ['-euo', 'pipefail', '-c', script], {
      cwd: directory,
      env: { ...process.env, TAG: '' },
    }).status,
    0,
  );
});
