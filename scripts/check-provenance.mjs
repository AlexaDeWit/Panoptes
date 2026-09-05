#!/usr/bin/env node
// Report which of the catalog's packages carries a verified npm provenance
// attestation, from which source repository, and fail where one that carried
// it no longer does or now names somewhere else.
//
//   scripts/check-provenance.mjs           check against dependency-provenance.txt
//   scripts/check-provenance.mjs --update  rewrite that record from what verifies now
//
// npm is the verifier rather than pnpm: `pnpm audit signatures` checks
// registry signatures alone and knows nothing of attestations. npm's own
// `audit signatures` checks both, but it walks a tree by dependency edges
// whose specifier is a registry range, and every catalog reference in this
// workspace reads `catalog:`. Run in place it therefore covers no catalog
// edge at all: whichever catalog packages it reaches, it reaches by accident
// through some transitive dependent that names them in a range, which on the
// tree as it stands leaves 31 of the 56 unreached. Coverage that moves with
// every unrelated dependency change is not a check.
//
// So npm is handed a throwaway tree instead: one directory per catalog
// package holding the name and the version pnpm-lock.yaml resolved, which is
// all it reads before fetching the registry's manifest and verifying the
// signature and the attestation against the sigstore trust root. Nothing is
// downloaded and nothing is installed.
//
// Node rather than bash, because the audit answers in JSON of a few megabytes
// and jq is not in the flake.
//
// Exit 1 is a provenance failure and exit 2 is a check that could not run: a
// registry out of reach, a lockfile or a record this cannot read, a catalog
// entry naming what npm would not accept as a package or what the lockfile
// does not install. docs/release.md says what to do with each.
import { execFileSync } from 'node:child_process';
import {
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

// The grammar npm accepts for a package name, bounded at npm's own limit of
// 214 characters. Every catalog name is checked against it before it becomes
// a path, because the lockfile is a file a pull request may edit: `../` in a
// name would otherwise be a directory this writes into, and a name past what
// a file system takes would be an unhandled ENAMETOOLONG.
const nameLimit = 214;
const packageName = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/;
const isPackageName = (name) =>
  name.length <= nameLimit && packageName.test(name);

const provenancePredicate = 'https://slsa.dev/provenance/v1';
const unknownRepository = '-';

const recordHeader = `# Every package in the pnpm-workspace.yaml catalog that carried a verified
# npm provenance attestation when this file was last written, and the source
# repository that attestation names. A "${unknownRepository}" is an attestation whose
# provenance statement names no repository.
#
# scripts/check-provenance.mjs reads it. A name here that no longer verifies
# is a lost attestation, and one whose attestation now names another
# repository is a release built somewhere new: both fail the check, because
# the verification itself carries no identity policy and would take either.
# A catalog package that verifies and is absent here is a record out of date.
# No version is recorded, so a bump that keeps the attestation and the
# repository leaves this file untouched. The catalog's other packages publish
# no attestation at all, and the check prints them as the residual.
#
# Regenerate with: scripts/check-provenance.mjs --update
`;

const cannotRun = (lines) => {
  for (const line of lines) console.error(line);
  return 2;
};

// Node's filesystem calls throw, and this script's error channel is an exit
// code with a sentence beside it, so every one a hostile lockfile or an
// unreadable checkout could break comes back as null and leaves through
// cannotRun instead of a stack trace under the exit code that means a
// provenance failure.
const attempt = (act) => {
  try {
    return act();
  } catch {
    return null;
  }
};

// pnpm writes the version each catalog specifier resolved to under
// `catalogs:`, which is meant to be the version installed rather than the
// range asked for. A named catalog sits between the two, so the names are
// four spaces in and their versions six. Nothing in that block proves the
// claim, so readCatalogResolutions below reads what the workspace projects
// resolve, and main refuses a catalog entry the two disagree about.
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

// What each workspace project resolves a `catalog:` reference to, out of the
// `importers:` block: project at two spaces, dependency section at four, the
// name at six, its specifier and version at eight. The version carries peer
// suffixes in brackets, and the part before the first bracket is the version.
//
// This is the witness for what pnpm installs, and the `packages:` block is
// not: that block carries every version anywhere in the resolved graph,
// transitive ones included, so a catalog entry could name a version present
// there as some other package's dependency and never be the version any
// project resolves. Six catalog names sit in `packages:` at two versions on
// the tree as it stands.
const readCatalogResolutions = (lockText) => {
  const resolutions = new Map();
  let inImporters = false;
  let name = null;
  let viaCatalog = false;
  for (const line of lockText.split('\n')) {
    if (!inImporters) {
      inImporters = line === 'importers:';
      continue;
    }
    if (/^\S/.test(line)) break;
    const named = /^ {6}'?([^':]+)'?:$/.exec(line);
    if (named) {
      name = named[1];
      viaCatalog = false;
      continue;
    }
    if (/^ {8}specifier: '?catalog:/.test(line)) {
      viaCatalog = true;
      continue;
    }
    const version = /^ {8}version: '?([^'\s(]+)/.exec(line);
    if (version && name !== null && viaCatalog) {
      if (!resolutions.has(name)) resolutions.set(name, new Set());
      resolutions.get(name).add(version[1]);
      name = null;
      viaCatalog = false;
    }
  }
  return resolutions;
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

// npm answers in JSON whether it verified anything or not: a signature that
// does not verify exits 1 carrying the findings, and a registry it cannot
// reach exits 1 carrying {"error": ...}. Neither the exit code nor
// parseability separates those two, so the three arrays an audit answers with
// are the test, and their absence is what the retry and exit 2 are for.
const isAuditAnswer = (value) =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray(value.verified) &&
  Array.isArray(value.invalid) &&
  Array.isArray(value.missing);

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
    const parsed = JSON.parse(stdout);
    return isAuditAnswer(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const audit = (root) => auditOnce(root) ?? auditOnce(root);

const parseStatement = (payload) => {
  if (typeof payload !== 'string') return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return null;
  }
};

// The audit hands back the bundles it verified, and the SLSA provenance
// statement inside one names the repository the release was built from. That
// identity is the part the verification does not check: pacote calls
// sigstore.verify with no certificate identity policy, so an attestation from
// any repository at all satisfies it. Recording the repository is what turns
// a move to another one into a decision rather than a silent pass.
const sourceRepository = (entry) => {
  for (const attestation of entry.attestationBundles ?? []) {
    if (attestation.predicateType !== provenancePredicate) continue;
    const statement = parseStatement(attestation.bundle?.dsseEnvelope?.payload);
    const workflow =
      statement?.predicate?.buildDefinition?.externalParameters?.workflow;
    if (
      typeof workflow?.repository === 'string' &&
      workflow.repository !== ''
    ) {
      return workflow.repository;
    }
  }
  return unknownRepository;
};

const attestedSources = (catalog, audited) => {
  const sources = new Map();
  for (const entry of audited.verified) {
    if (catalog.has(entry.name))
      sources.set(entry.name, sourceRepository(entry));
  }
  return sources;
};

const report = (heading, lines) => {
  console.log(heading);
  for (const line of lines) console.log(`  ${line}`);
  console.log('');
};

const check = (catalog, audited, recorded) => {
  const attested = attestedSources(catalog, audited);
  const names = [...catalog.keys()].sort();

  console.log(
    `${names.length} packages in the catalog, ${attested.size} with a verified provenance attestation.`,
  );
  console.log('');

  report(
    'Verified provenance attestation, and the repository it names:',
    names
      .filter((name) => attested.has(name))
      .map((name) => `${name} ${catalog.get(name)} ${attested.get(name)}`),
  );

  const residual = names.filter((name) => !attested.has(name));
  if (residual.length > 0) {
    report(
      'No provenance attestation published (the residual):',
      residual.map((name) => `${name} ${catalog.get(name)}`),
    );
  }

  const failures = [];

  const lost = [...recorded.keys()].filter(
    (name) => catalog.has(name) && !attested.has(name),
  );
  if (lost.length > 0) {
    report(`Attestation lost since ${recordName} was written:`, lost);
    failures.push('an attestation this repository recorded is gone');
  }

  const moved = [...recorded.keys()].filter(
    (name) => attested.has(name) && attested.get(name) !== recorded.get(name),
  );
  if (moved.length > 0) {
    report(
      'Attestation now names another source repository:',
      moved.map(
        (name) => `${name} ${recorded.get(name)} is now ${attested.get(name)}`,
      ),
    );
    failures.push(
      'a release is attested from a repository this one did not record',
    );
  }

  const gained = [...attested.keys()]
    .filter((name) => !recorded.has(name))
    .sort();
  const departed = [...recorded.keys()].filter((name) => !catalog.has(name));
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
  const attested = attestedSources(catalog, audited);
  const lines = [...attested.keys()]
    .sort()
    .map((name) => `${name} ${attested.get(name)}\n`)
    .join('');
  const written = attempt(() => {
    writeFileSync(recordPath, `${recordHeader}${lines}`);
    return true;
  });
  if (written === null) {
    return cannotRun([`cannot write ${recordPath}`]);
  }
  console.log(
    `wrote ${recordName}: ${attested.size} of ${catalog.size} packages in the catalog`,
  );
  return 0;
};

const readRecord = (recordText) => {
  const recorded = new Map();
  for (const line of recordText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const [name, repository = unknownRepository] = trimmed.split(/\s+/);
    recorded.set(name, repository);
  }
  return recorded;
};

const main = () => {
  const argument = process.argv[2];
  if (argument !== undefined && argument !== '--update') {
    return cannotRun(['usage: scripts/check-provenance.mjs [--update]']);
  }

  const lockText = attempt(() => readFileSync(lockPath, 'utf8'));
  if (lockText === null) {
    return cannotRun([
      `cannot read ${lockPath}: run this from a checkout of the repository`,
    ]);
  }

  const catalog = readCatalog(lockText);
  if (catalog.size === 0) {
    return cannotRun([
      `no catalog in ${lockPath}: its shape is not the one this reads`,
    ]);
  }

  const malformed = [...catalog.keys()].filter((name) => !isPackageName(name));
  if (malformed.length > 0) {
    return cannotRun([
      `${lockPath} holds what npm would not accept as a package name:`,
      ...malformed.map((name) => `  ${name}`),
    ]);
  }

  const resolutions = readCatalogResolutions(lockText);
  const unreferenced = [...catalog.keys()].filter(
    (name) => !resolutions.has(name),
  );
  if (unreferenced.length > 0) {
    return cannotRun([
      `${lockPath} catalogues what no workspace project references, so`,
      'nothing says which version an install would carry:',
      ...unreferenced.map((name) => `  ${name}`),
    ]);
  }

  const disagreed = [...catalog]
    .filter(([name, version]) =>
      [...resolutions.get(name)].some((resolved) => resolved !== version),
    )
    .map(
      ([name, version]) =>
        `  ${name} catalogued at ${version}, resolved to ${[...resolutions.get(name)].sort().join(', ')}`,
    );
  if (disagreed.length > 0) {
    return cannotRun([
      `${lockPath} catalogues a version its importers do not resolve, so an`,
      'attestation would be read for something the install does not carry:',
      ...disagreed,
    ]);
  }

  const recordText =
    argument === '--update'
      ? ''
      : attempt(() => readFileSync(recordPath, 'utf8'));
  if (recordText === null) {
    return cannotRun([
      `cannot read ${recordName}: write it with scripts/check-provenance.mjs --update`,
    ]);
  }

  const root = attempt(() =>
    mkdtempSync(join(tmpdir(), 'panoptes-provenance-')),
  );
  if (root === null) {
    return cannotRun([
      `cannot make a directory under ${tmpdir()}, so npm has no tree to audit`,
    ]);
  }

  let probed = false;
  let audited = null;
  try {
    probed =
      attempt(() => {
        writeProbeTree(root, catalog);
        return true;
      }) === true;
    if (probed) audited = audit(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  if (!probed) {
    return cannotRun([
      `cannot write the tree npm audits under ${tmpdir()}, so nothing was verified`,
    ]);
  }

  if (audited === null) {
    return cannotRun([
      'npm audit signatures answered no verification, twice.',
      'The registry or the sigstore trust root was out of reach, so',
      'nothing was verified and no provenance claim is made either way.',
    ]);
  }

  if (argument === '--update') return update(catalog, audited);
  return check(catalog, audited, readRecord(recordText));
};

process.exitCode = main();
