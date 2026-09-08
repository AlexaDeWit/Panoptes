import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { z } from 'zod';
import { updateNixRelease } from './nix-release.mts';
import {
  fakeRunner,
  key,
  leftText,
  result,
  right,
  temporaryWorkspace,
  workspaceRoot,
} from './release.fixtures.mts';
import type { CommandResult } from './release-io.mts';

const manifestSchema = z.object({
  version: z.string(),
  binaryName: z.enum(['saer', 'saerskriven']),
  assets: z.record(
    z.string(),
    z.object({ target: z.string(), hash: z.string() }),
  ),
});
const manifestText = readFileSync(
  join(workspaceRoot, 'nix/release.json'),
  'utf8',
);
const manifest = manifestSchema.parse(JSON.parse(manifestText));
const repository = 'AlexaDeWit/Saerskriven';
const commit = 'a'.repeat(40);
const tagObject = 'b'.repeat(40);
const releaseEndpoint = `repos/${repository}/releases/tags/v1.2.3`;

const fixture = (failure = '') => {
  const cwd = temporaryWorkspace();
  mkdirSync(join(cwd, 'nix'));
  const destination = join(cwd, 'nix/release.json');
  writeFileSync(destination, failure === 'manifest' ? '{}' : manifestText);
  const responses = new Map<string, CommandResult>([
    [
      key('gh', ['api', releaseEndpoint]),
      failure === 'api'
        ? result(1)
        : result(
            0,
            failure === 'json'
              ? '{'
              : JSON.stringify({
                  draft: failure === 'draft',
                  prerelease: false,
                  tag_name: 'v1.2.3',
                  assets:
                    failure === 'missing-assets'
                      ? []
                      : Object.values(manifest.assets).map(({ target }) => ({
                          name: `${failure === 'legacy' ? 'saerskriven' : 'saer'}-1.2.3-${target}`,
                        })),
                }),
          ),
    ],
    [
      key('gh', ['api', `repos/${repository}/git/ref/tags/v1.2.3`]),
      result(
        0,
        JSON.stringify({
          object: {
            type: failure === 'lightweight-tag' ? 'commit' : 'tag',
            sha: tagObject,
          },
        }),
      ),
    ],
    [
      key('gh', ['api', `repos/${repository}/git/tags/${tagObject}`]),
      result(0, JSON.stringify({ object: { type: 'commit', sha: commit } })),
    ],
  ]);
  const runner = fakeRunner(responses, ({ command, args }) => {
    if (command !== 'gh') return undefined;
    if (args[0] === 'release' && args[1] === 'download') {
      if (failure === 'download') return result(1);
      const directory = args[args.indexOf('--dir') + 1];
      const name = args[args.indexOf('--pattern') + 1];
      assert.ok(directory && name);
      writeFileSync(join(directory, name), `binary: ${name}`);
      return result();
    }
    if (
      args[0] === 'attestation' &&
      failure === 'last-attestation' &&
      args[2]?.endsWith('aarch64-apple-darwin')
    )
      return result(1);
    return undefined;
  });
  return { ...runner, cwd, destination };
};

void test('the updater pins hashes from verified asset bytes for the explicit release', () => {
  const probe = fixture();
  right(updateNixRelease({ cwd: probe.cwd, input: 'v1.2.3', run: probe.run }));
  const updated = manifestSchema.parse(
    JSON.parse(readFileSync(probe.destination, 'utf8')),
  );
  assert.equal(updated.version, '1.2.3');
  assert.equal(updated.binaryName, 'saer');
  assert.deepEqual(Object.keys(updated.assets), Object.keys(manifest.assets));
  for (const { target, hash } of Object.values(updated.assets)) {
    assert.equal(
      hash,
      createHash('sha256').update(`binary: saer-1.2.3-${target}`).digest('hex'),
    );
  }
  const verifications = probe.calls.filter(
    ({ args }) => args[0] === 'attestation',
  );
  assert.equal(verifications.length, 4);
  for (const { args } of verifications) {
    assert.equal(args[args.indexOf('--source-ref') + 1], 'refs/tags/v1.2.3');
    assert.equal(args[args.indexOf('--source-digest') + 1], commit);
    assert.equal(args[args.indexOf('--repo') + 1], repository);
    assert.equal(
      args[args.indexOf('--signer-workflow') + 1],
      `${repository}/.github/workflows/ci.yml`,
    );
  }
  assert.equal(
    probe.calls.some(({ args }) => args.some((arg) => arg.includes('latest'))),
    false,
  );
  assert.deepEqual(readdirSync(join(probe.cwd, 'nix')), ['release.json']);
});

void test('the updater preserves the published binary name when pinning an older release', () => {
  const probe = fixture('legacy');
  right(updateNixRelease({ cwd: probe.cwd, input: 'v1.2.3', run: probe.run }));
  const updated = manifestSchema.parse(
    JSON.parse(readFileSync(probe.destination, 'utf8')),
  );
  assert.equal(updated.binaryName, 'saerskriven');
  for (const { target, hash } of Object.values(updated.assets)) {
    assert.equal(
      hash,
      createHash('sha256')
        .update(`binary: saerskriven-1.2.3-${target}`)
        .digest('hex'),
    );
  }
});

for (const failure of [
  'api',
  'json',
  'draft',
  'lightweight-tag',
  'manifest',
  'download',
  'last-attestation',
  'invalid-version',
  'missing-assets',
]) {
  void test(`the updater preserves the pin and removes downloads after ${failure} failure`, () => {
    const probe = fixture(failure);
    const before = readFileSync(probe.destination, 'utf8');
    leftText(
      updateNixRelease({
        cwd: probe.cwd,
        input: failure === 'invalid-version' ? 'latest' : '1.2.3',
        run: probe.run,
      }),
    );
    assert.equal(readFileSync(probe.destination, 'utf8'), before);
    assert.deepEqual(readdirSync(join(probe.cwd, 'nix')), ['release.json']);
  });
}
