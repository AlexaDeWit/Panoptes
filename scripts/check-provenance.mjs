#!/usr/bin/env node
// Report which of the catalog's packages carries a verified npm provenance
// attestation, and fail where one that carried it no longer does.
//
//   scripts/check-provenance.mjs           check against dependency-provenance.txt
//   scripts/check-provenance.mjs --update  rewrite that record from what verifies now
//
// npm is the verifier rather than pnpm: `pnpm audit signatures` checks
// registry signatures alone and knows nothing of attestations. npm's own
// `audit signatures` checks both, but it walks a tree by dependency edges
// whose specifier is a registry range, and every catalog reference in this
// workspace reads `catalog:`, so run here it skips exactly the packages this
// reports on. It is given a throwaway tree instead: one directory per catalog
// package holding the name and the version pnpm-lock.yaml resolved, which is
// all npm reads before it fetches the registry's manifest and verifies the
// signature and the attestation against the sigstore trust root. Nothing is
// downloaded and nothing is installed.
//
// Node rather than bash, because the audit answers in JSON of a few megabytes
// and jq is not in the flake.
//
// The registry is reached over the network, so the audit is attempted twice
// before the check reports that it could not run. That is exit code 2, apart
// from the 1 a provenance failure exits with, and docs/release.md says what to
// do with each.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = join(repoRoot, 'pnpm-lock.yaml');
const recordName = 'dependency-provenance.txt';
const recordPath = join(repoRoot, recordName);

const recordHeader = `# Every package in the pnpm-workspace.yaml catalog that carried a verified
# npm provenance attestation when this file was last written.
# scripts/check-provenance.mjs reads it: a name here that no longer verifies
# is a lost attestation and fails the check, and a catalog package that
# verifies and is absent here is a record out of date. Names alone, so a
# version bump that keeps the attestation leaves this file untouched. The
# catalog's other packages publish no attestation at all, and the check
# prints them as the residual.
#
# Regenerate with: scripts/check-provenance.mjs --update
`;

// pnpm writes the version each catalog specifier resolved to under
// `catalogs:`, which is the version actually installed rather than the range
// asked for. A named catalog sits between the two, so the names are four
// spaces in and their versions six.
const readCatalog = (lockText) => {
  const versions = new Map();
  let inCatalogs = false;
  let name = null;
  for (const line of lockText.split('\n')) {
    if (!inCatalogs) {
      inCatalogs = line === 'catalogs:';
      continue;
    }
    if (/^\S/.test(line)) break;
    const named = /^ {4}'?([^':]+)'?:$/.exec(line);
    if (named) {
      name = named[1];
      continue;
    }
    const resolved = /^ {6}version: '?([^'\s(]+)'?/.exec(line);
    if (resolved && name !== null) {
      versions.set(name, resolved[1]);
      name = null;
    }
  }
  return versions;
};

const writeProbeTree = (root, catalog) => {
  const dependencies = Object.fromEntries([...catalog].sort());
  const probe = {
    name: 'panoptes-provenance-probe',
    version: '0.0.0',
    private: true,
    dependencies,
  };
  writeFileSync(join(root, 'package.json'), JSON.stringify(probe));
  for (const [name, version] of catalog) {
    const directory = join(root, 'node_modules', name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({ name, version }),
    );
  }
};

// npm exits 1 and still answers in JSON where a signature or an attestation
// fails to verify, so the exit code alone does not separate a finding from a
// registry that could not be reached. Parseable output is the test.
const auditOnce = (root) => {
  const command = ['audit', 'signatures', '--json', '--include-attestations'];
  const options = { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 };
  let stdout = '';
  try {
    stdout = execFileSync('npm', command, options);
  } catch (error) {
    stdout = typeof error.stdout === 'string' ? error.stdout : '';
  }
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
};

const audit = (root) => auditOnce(root) ?? auditOnce(root);

const attestedNames = (catalog, audited) =>
  new Set(
    audited.verified
      .filter((entry) => catalog.has(entry.name))
      .map((entry) => entry.name),
  );

const report = (heading, lines) => {
  console.log(heading);
  for (const line of lines) console.log(`  ${line}`);
  console.log('');
};

const check = (catalog, audited, recorded) => {
  const attested = attestedNames(catalog, audited);
  const names = [...catalog.keys()].sort();

  console.log(
    `${names.length} packages in the catalog, ${attested.size} with a verified provenance attestation.`,
  );
  console.log('');

  const residual = names.filter((name) => !attested.has(name));
  if (residual.length > 0) {
    report(
      'No provenance attestation published (the residual):',
      residual.map((name) => `${name} ${catalog.get(name)}`),
    );
  }

  const failures = [];

  const lost = recorded.filter(
    (name) => catalog.has(name) && !attested.has(name),
  );
  if (lost.length > 0) {
    report(`Attestation lost since ${recordName} was written:`, lost);
    failures.push('an attestation this repository recorded is gone');
  }

  const gained = [...attested]
    .filter((name) => !recorded.includes(name))
    .sort();
  const departed = recorded.filter((name) => !catalog.has(name));
  if (gained.length > 0 || departed.length > 0) {
    report(`${recordName} is out of date:`, [
      ...gained.map((name) => `${name} now verifies and is not recorded`),
      ...departed.map(
        (name) => `${name} is recorded and is no longer in the catalog`,
      ),
    ]);
    failures.push(`${recordName} and the catalog have parted`);
  }

  if (audited.invalid.length > 0) {
    report(
      'Signature or attestation that does not verify:',
      audited.invalid.map(
        (entry) => `${entry.name}@${entry.version} ${entry.code}`,
      ),
    );
    failures.push('a signature or an attestation did not verify');
  }

  const unsigned = audited.missing.filter((entry) => catalog.has(entry.name));
  if (unsigned.length > 0) {
    report(
      'No registry signature where the registry publishes signing keys:',
      unsigned.map((entry) => `${entry.name}@${entry.version}`),
    );
    failures.push('a registry signature is absent');
  }

  if (failures.length === 0) return 0;
  for (const failure of failures)
    console.error(`provenance check failed: ${failure}`);
  console.error(
    'Read the report above, then run scripts/check-provenance.mjs --update',
  );
  console.error('if the change is one this repository accepts.');
  return 1;
};

const update = (catalog, audited) => {
  const attested = [...attestedNames(catalog, audited)].sort();
  writeFileSync(
    recordPath,
    `${recordHeader}${attested.map((name) => `${name}\n`).join('')}`,
  );
  console.log(
    `wrote ${recordName}: ${attested.length} of ${catalog.size} packages in the catalog`,
  );
  return 0;
};

const readRecord = () =>
  readFileSync(recordPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

const main = () => {
  const argument = process.argv[2];
  if (argument !== undefined && argument !== '--update') {
    console.error('usage: scripts/check-provenance.mjs [--update]');
    return 2;
  }

  const catalog = readCatalog(readFileSync(lockPath, 'utf8'));
  if (catalog.size === 0) {
    console.error(
      `no catalog in ${lockPath}: its shape is not the one this reads`,
    );
    return 2;
  }

  const root = mkdtempSync(join(tmpdir(), 'panoptes-provenance-'));
  let audited = null;
  try {
    writeProbeTree(root, catalog);
    audited = audit(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  if (audited === null) {
    console.error('npm audit signatures answered nothing parseable, twice.');
    console.error(
      'The registry or the sigstore trust root was out of reach, so',
    );
    console.error(
      'nothing was verified and no provenance claim is made either way.',
    );
    return 2;
  }

  if (argument === '--update') return update(catalog, audited);
  if (!existsSync(recordPath)) {
    console.error(
      `no ${recordName}: write it with scripts/check-provenance.mjs --update`,
    );
    return 2;
  }
  return check(catalog, audited, readRecord());
};

process.exitCode = main();
