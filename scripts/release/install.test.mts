import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { temporaryWorkspace, workspaceRoot } from './release.fixtures.mts';

const payload = '#!/bin/sh\necho executed > "$HOME/executed"\n';
const digest = createHash('sha256').update(payload).digest('hex');
const targets = [
  ['Linux', 'x86_64', 'x86_64-unknown-linux-gnu'],
  ['Linux', 'aarch64', 'aarch64-unknown-linux-gnu'],
  ['Darwin', 'x86_64', 'x86_64-apple-darwin'],
  ['Darwin', 'arm64', 'aarch64-apple-darwin'],
] as const;

const fixture = (os = 'Linux', arch = 'x86_64', sha = 'sha256sum') => {
  const directory = temporaryWorkspace();
  const bin = join(directory, 'tools');
  const home = join(directory, 'user home');
  const temp = join(directory, 'tmp');
  const releases = join(directory, 'dist/cli');
  for (const path of [bin, home, temp, releases])
    mkdirSync(path, { recursive: true });
  writeFileSync(join(directory, 'package.json'), '{"version":"1.2.3"}');
  for (const [, , target] of targets) {
    writeFileSync(join(releases, `saerskriven-1.2.3-${target}`), payload);
  }
  writeFileSync(
    join(releases, 'saerskriven-1.2.3-x86_64-pc-windows-msvc.exe'),
    payload,
  );
  const packaged = spawnSync(
    'bash',
    [join(workspaceRoot, 'scripts/release/package-installer.sh')],
    {
      cwd: directory,
      encoding: 'utf8',
    },
  );
  assert.equal(packaged.status, 0, packaged.stderr);
  for (const tool of [
    'bash',
    'awk',
    'mktemp',
    'rm',
    'mkdir',
    'cp',
    'chmod',
    'mv',
    ...(sha ? [sha] : []),
  ]) {
    const found = spawnSync('bash', ['-c', 'command -v "$1"', 'probe', tool], {
      encoding: 'utf8',
    });
    assert.equal(found.status, 0, found.stderr);
    symlinkSync(found.stdout.trim(), join(bin, tool));
  }
  symlinkSync(process.execPath, join(bin, 'node'));
  writeFileSync(
    join(bin, 'id'),
    '#!/usr/bin/env bash\nprintf "%s\\n" "${INSTALL_TEST_UID:-1000}"\n',
    { mode: 0o755 },
  );
  writeFileSync(
    join(bin, 'uname'),
    '#!/usr/bin/env bash\nif [ "$1" = -s ]; then echo "$INSTALL_TEST_OS"; else echo "$INSTALL_TEST_ARCH"; fi\n',
    { mode: 0o755 },
  );
  const log = join(directory, 'calls');
  writeFileSync(log, '');
  writeFileSync(
    join(bin, 'curl'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const url = args.at(-1);
fs.appendFileSync(process.env.INSTALL_TEST_LOG, url + '\\n');
for (const [flag, value] of [['--proto', '=https'], ['--proto-redir', '=https'], ['--tlsv1.2', undefined]]) {
  if (!args.includes(flag) || (value && args[args.indexOf(flag) + 1] !== value)) process.exit(2);
}
if (args[0] !== '-q' || !args.includes('--fail') || !args.includes('--location')) process.exit(2);
const base = 'https://github.com/AlexaDeWit/Saerskriven/releases/download/v1.2.3/';
if (!url.startsWith(base)) process.exit(2);
const name = url.slice(base.length);
if (process.env.INSTALL_TEST_FAILURE === name) process.exit(22);
fs.copyFileSync(path.join(process.env.INSTALL_TEST_RELEASES, name), args[args.indexOf('--output') + 1]);
if (process.env.INSTALL_TEST_FAILURE === 'signal') process.kill(process.ppid, 'SIGTERM');
`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(bin, 'gh'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.INSTALL_TEST_LOG, JSON.stringify(args) + '\\n');
if (process.env.INSTALL_TEST_FAILURE === 'attestation') process.exit(1);
`,
    { mode: 0o755 },
  );
  const destination = join(home, '.local/bin/saerskriven');
  return {
    bin,
    home,
    temp,
    releases,
    destination,
    calls: () => readFileSync(log, 'utf8'),
    sums: (text: string) => {
      const script = join(releases, 'install.sh');
      writeFileSync(
        script,
        readFileSync(script, 'utf8').replace(
          /readonly release_checksums='[^']*'/u,
          `readonly release_checksums='\n${text}'`,
        ),
      );
    },
    previous: () => {
      mkdirSync(join(home, '.local/bin'), { recursive: true });
      writeFileSync(destination, 'previous executable', { mode: 0o755 });
    },
    run: (args: string[] = [], env: Record<string, string> = {}) =>
      spawnSync('bash', [join(releases, 'install.sh'), ...args], {
        cwd: directory,
        encoding: 'utf8',
        timeout: 10_000,
        env: {
          ...process.env,
          PATH: bin,
          HOME: home,
          TMPDIR: temp,
          INSTALL_TEST_OS: os,
          INSTALL_TEST_ARCH: arch,
          INSTALL_TEST_RELEASES: releases,
          INSTALL_TEST_LOG: log,
          ...env,
        },
      }),
  };
};

for (const [os, arch, target] of targets) {
  void test(`installs verified ${target} bytes without executing them`, () => {
    const probe = fixture(os, arch, os === 'Darwin' ? 'shasum' : 'sha256sum');
    const result = probe.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(probe.destination, 'utf8'), payload);
    assert.equal(statSync(probe.destination).mode & 0o777, 0o755);
    assert.equal(existsSync(join(probe.home, 'executed')), false);
    assert.match(probe.calls(), new RegExp(`saerskriven-1.2.3-${target}`, 'u'));
    assert.match(result.stdout, /PATH/u);
    assert.deepEqual(readdirSync(probe.temp), []);
    assert.deepEqual(readdirSync(join(probe.home, '.local/bin')), [
      'saerskriven',
    ]);
  });
}

void test('packaging pins the installer tag and includes its digest in SHA256SUMS', () => {
  const probe = fixture();
  const installer = readFileSync(join(probe.releases, 'install.sh'), 'utf8');
  assert.match(installer, /release_tag='v1\.2\.3'/u);
  assert.equal(installer.includes('@RELEASE_TAG@'), false);
  assert.equal(installer.includes('@RELEASE_SHA256SUMS@'), false);
  for (const [, , target] of targets) {
    assert.ok(installer.includes(`${digest}  saerskriven-1.2.3-${target}\n`));
  }
  assert.ok(
    installer.includes(
      `${digest}  saerskriven-1.2.3-x86_64-pc-windows-msvc.exe\n`,
    ),
  );
  assert.ok(
    readFileSync(join(probe.releases, 'SHA256SUMS'), 'utf8').includes(
      `${createHash('sha256').update(installer).digest('hex')}  install.sh\n`,
    ),
  );
});

const asset = 'saerskriven-1.2.3-x86_64-unknown-linux-gnu';
for (const [name, manifest] of [
  ['missing', `${digest}  unrelated\n`],
  ['wrong release', `${digest}  saerskriven-9.9.9-x86_64-unknown-linux-gnu\n`],
  ['duplicate', `${digest}  ${asset}\n${digest}  ${asset}\n`],
  ['malformed duplicate', `${digest}  ${asset}\nabcd  ${asset}\n`],
  ['malformed', `${'x'.repeat(64)}  ${asset}\n`],
  ['short hash', `abcd  ${asset}\n`],
  ['mismatch', `${'0'.repeat(64)}  ${asset}\n`],
  ['path traversal', `${digest}  ../${asset}\n`],
]) {
  void test(`a ${name} checksum preserves the previous install`, () => {
    const probe = fixture();
    probe.previous();
    assert.ok(manifest);
    probe.sums(manifest);
    const result = probe.run();
    assert.notEqual(result.status, 0);
    assert.equal(
      readFileSync(probe.destination, 'utf8'),
      'previous executable',
    );
    assert.deepEqual(readdirSync(probe.temp), []);
  });
}

for (const failure of [asset, 'attestation', 'signal']) {
  void test(`${failure} failure preserves the previous install and removes downloads`, () => {
    const probe = fixture();
    probe.previous();
    const result = probe.run(['--verify-attestation'], {
      INSTALL_TEST_FAILURE: failure,
    });
    assert.notEqual(result.status, 0);
    assert.equal(
      readFileSync(probe.destination, 'utf8'),
      'previous executable',
    );
    assert.deepEqual(readdirSync(probe.temp), []);
  });
}

void test('attestation requires the release repository, workflow, and source ref', () => {
  const probe = fixture();
  const result = probe.run(['--verify-attestation']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(probe.calls(), /"attestation","verify"/u);
  assert.match(probe.calls(), /"--repo","AlexaDeWit\/Saerskriven"/u);
  assert.match(
    probe.calls(),
    /"--signer-workflow","AlexaDeWit\/Saerskriven\/\.github\/workflows\/ci\.yml"/u,
  );
  assert.match(probe.calls(), /"--source-ref","refs\/tags\/v1\.2\.3"/u);
});

void test('a verified update replaces the previous file and respects a custom PATH directory', () => {
  const probe = fixture();
  probe.previous();
  const result = probe.run(['--bin-dir', join(probe.home, '.local/bin')], {
    PATH: `${probe.bin}:${join(probe.home, '.local/bin')}`,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(probe.destination, 'utf8'), payload);
  assert.doesNotMatch(result.stdout, /Add .* to PATH/u);
  const custom = join(probe.home, 'custom bin');
  assert.equal(probe.run(['--bin-dir', custom]).status, 0);
  assert.equal(readFileSync(join(custom, 'saerskriven'), 'utf8'), payload);
});

for (const kind of ['symlink', 'directory']) {
  void test(`refuses a ${kind} at the executable path`, () => {
    const probe = fixture();
    mkdirSync(join(probe.home, '.local/bin'), { recursive: true });
    if (kind === 'symlink')
      symlinkSync(join(probe.home, 'absent'), probe.destination);
    else mkdirSync(probe.destination);
    assert.notEqual(probe.run().status, 0);
    assert.deepEqual(readdirSync(probe.temp), []);
    assert.equal(existsSync(join(probe.home, 'absent')), false);
  });
}

void test('refuses unsupported platforms, root, missing checksum tools, and invalid arguments before downloading', () => {
  for (const probe of [
    fixture('Windows'),
    fixture('Linux', 'i686'),
    fixture('Linux', 'x86_64', ''),
  ]) {
    assert.notEqual(probe.run().status, 0);
    assert.equal(probe.calls(), '');
  }
  const probe = fixture();
  for (const args of [
    ['--bin-dir'],
    ['--bin-dir', 'relative'],
    ['--unknown'],
  ]) {
    assert.notEqual(probe.run(args).status, 0);
  }
  assert.notEqual(probe.run([], { INSTALL_TEST_UID: '0' }).status, 0);
  assert.equal(probe.run(['--help']).status, 0);
  assert.equal(probe.calls(), '');
});
