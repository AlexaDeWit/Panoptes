#!/usr/bin/env node
// Report which of the catalog's packages carries a verified npm provenance
// attestation and from which source repository, and fail where a package
// attested on the base commit is not attested here, or is now attested from
// somewhere else.
//
//   scripts/check-provenance.mjs [--base <ref>]
//
// The baseline is git rather than a file kept in step with the catalog by
// hand: the base commit's lockfile, read out of the object store and audited
// now. HEAD^ is the default because it is the base on both events that run
// this, a pull request checked out as its merge commit and a push to main. A
// package pinned at the same version on both sides is one artifact and gets
// one answer, so only the packages whose version moved are audited twice,
// and only those can be reported lost or moved.
// dependency-provenance-moves.txt records the moves this repository accepts.
//
// npm is the verifier rather than pnpm: `pnpm audit signatures` checks
// registry signatures alone and knows nothing of attestations. npm's own
// `audit signatures` checks both, but it walks a tree by dependency edges
// whose specifier is a registry range, and every catalog reference here
// reads `catalog:`. Run in place it therefore covers no catalog edge at all:
// whichever catalog packages it reaches, it reaches by accident through some
// transitive dependent that names them in a range, which on the tree as it
// stands leaves 32 of the 56 unreached. Coverage that moves with every
// unrelated dependency change is not a check. So npm is handed a throwaway
// tree instead: one directory per catalog package holding the name and the
// version pnpm-lock.yaml resolved, which is all it reads before fetching the
// registry's manifest and verifying the signature and the attestation
// against the sigstore trust root. Nothing is downloaded and nothing is
// installed.
//
// Exit 1 is a provenance failure and exit 2 is a check that could not run: a
// registry out of reach, a lockfile or an exceptions file this cannot read, a
// catalog entry naming what npm would not accept as a package or what the
// lockfile does not install. docs/release.md says what to do with each.
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

// The catalog's own YAML parser, imported dynamically so a checkout that has
// not installed leaves through cannotRun rather than a module-resolution
// stack trace under the exit code that means a provenance failure.
const yaml = await import('yaml').catch(() => null);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const lockName = 'pnpm-lock.yaml';
const lockPath = join(repoRoot, lockName);
const movesName = 'dependency-provenance-moves.txt';
const movesPath = join(repoRoot, movesName);

// The grammar npm accepts for a package name, bounded at npm's own limit of
// 214 characters. Every catalog name passes it before it becomes a path,
// because the lockfile is a file a pull request may edit: `../` in a name
// would otherwise be a directory this writes into, and a name past what a
// file system takes an unhandled ENAMETOOLONG.
const nameLimit = 214;
const packageName = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/;
const isPackageName = (name) =>
  name.length <= nameLimit && packageName.test(name);

const provenancePredicate = 'https://slsa.dev/provenance/v1';
const unknownRepository = '-';

const cannotRun = (lines) => {
  for (const line of lines) console.error(line);
  return 2;
};

// Node's filesystem calls throw, and this script's error channel is an exit
// code with a sentence beside it, so what a hostile lockfile or an unreadable
// checkout could break comes back as null and leaves through cannotRun rather
// than as a stack trace under the code that means a provenance failure.
const attempt = (act) => {
  try {
    return act();
  } catch {
    return null;
  }
};

const readLock = (read) => {
  const text = attempt(read);
  return text === null ? null : attempt(() => yaml.parse(text));
};

const lockAt = (ref) =>
  execFileSync('git', ['show', `${ref}:${lockName}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // git's own diagnostic would land beside this script's sentence.
    stdio: ['ignore', 'pipe', 'ignore'],
  });

// pnpm writes the version each catalog specifier resolved to under
// `catalogs:`, which is meant to be the version installed rather than the
// range asked for. The block is keyed by catalog name and this reads through
// to the package names alone, so two named catalogs pinning one package at
// two versions leave one entry; the importers witness below refuses that,
// since no single version then matches every resolution.
const catalogVersions = (lock) => {
  const versions = new Map();
  for (const packages of Object.values(lock?.catalogs ?? {})) {
    for (const [name, entry] of Object.entries(packages ?? {})) {
      if (entry?.version !== undefined)
        versions.set(name, String(entry.version));
    }
  }
  return versions;
};

// What each workspace project resolves a `catalog:` reference to, out of the
// `importers:` block, with the peer suffix in brackets dropped.
//
// This is the witness for what pnpm installs, and the `packages:` block is
// not: that block carries every version anywhere in the resolved graph, so a
// catalog entry could name a version present there only as some other
// package's dependency. Six catalog names sit in `packages:` at two versions
// on the tree as it stands.
const catalogResolutions = (lock) => {
  const resolutions = new Map();
  for (const importer of Object.values(lock?.importers ?? {})) {
    for (const section of Object.values(importer ?? {})) {
      for (const [name, entry] of Object.entries(section ?? {})) {
        if (typeof entry?.specifier !== 'string') continue;
        if (!entry.specifier.startsWith('catalog:')) continue;
        if (!resolutions.has(name)) resolutions.set(name, new Set());
        resolutions.get(name).add(String(entry.version).split('(')[0]);
      }
    }
  }
  return resolutions;
};

const writeProbeTree = (root, catalog) => {
  const probe = {
    name: 'panoptes-provenance-probe',
    version: '0.0.0',
    private: true,
    dependencies: Object.fromEntries([...catalog].sort()),
  };
  mkdirSync(root, { recursive: true });
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
// parseability separates those two, so the three arrays an audit answers
// with are the test, and their absence is what the retry and exit 2 are for.
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
// sigstore.verify with no certificate identity policy, so an attestation
// from anywhere satisfies it. Comparing it with the base commit's is what
// turns a move into a decision rather than a silent pass.
const sourceRepository = (entry) => {
  for (const attestation of entry.attestationBundles ?? []) {
    if (attestation.predicateType !== provenancePredicate) continue;
    const statement = parseStatement(attestation.bundle?.dsseEnvelope?.payload);
    const repository =
      statement?.predicate?.buildDefinition?.externalParameters?.workflow
        ?.repository;
    if (typeof repository === 'string' && repository !== '') return repository;
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

// The moves this repository has accepted, one `name old-repository
// new-repository` per line, held as the whole line so an exception admits
// the move it names and no other. Null where the file will not read.
const acceptedMoves = () => {
  const text = attempt(() => readFileSync(movesPath, 'utf8'));
  if (text === null) return null;
  const accepted = new Set();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const fields = trimmed.split(/\s+/);
    if (fields.length !== 3) return null;
    accepted.add(fields.join(' '));
  }
  return accepted;
};

const report = (heading, lines) => {
  console.log(heading);
  for (const line of lines) console.log(`  ${line}`);
  console.log('');
};

// 0 where this commit's catalog is as attested as the base commit's, 1 for a
// provenance failure, and 2 where a move was found and the file that would
// accept it could not be read.
const check = ({ catalog, attested, audited, base, baseAttested }) => {
  const names = [...catalog.keys()].sort();

  console.log(
    `${names.length} packages in the catalog, ${attested.size} with a verified provenance attestation, ${base.size} whose version moved since the base commit.`,
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

  const lost = [...baseAttested.keys()]
    .filter((name) => !attested.has(name))
    .sort();
  if (lost.length > 0) {
    report(
      'Attestation lost since the base commit:',
      lost.map(
        (name) =>
          `${name} ${base.get(name)} carried one, ${catalog.get(name)} does not`,
      ),
    );
    failures.push('a package attested on the base commit is not attested here');
  }

  const moved = [...baseAttested.keys()]
    .filter(
      (name) =>
        attested.has(name) && attested.get(name) !== baseAttested.get(name),
    )
    .sort();
  const accepted = moved.length === 0 ? new Set() : acceptedMoves();
  if (accepted === null) {
    return cannotRun([
      `an attestation names another repository and ${movesName} cannot be`,
      'read as lines of "name old-repository new-repository", so nothing',
      'says whether the move is one this repository has accepted',
    ]);
  }
  const unaccepted = moved.filter(
    (name) =>
      !accepted.has(`${name} ${baseAttested.get(name)} ${attested.get(name)}`),
  );
  if (unaccepted.length > 0) {
    report(
      'Attestation now names another source repository:',
      unaccepted.map(
        (name) =>
          `${name} ${baseAttested.get(name)} is now ${attested.get(name)}`,
      ),
    );
    failures.push(
      'a release is attested from a repository the base commit did not name',
    );
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
  console.error('Read the report above.');
  if (unaccepted.length > 0) {
    console.error(
      `A move this project takes goes in ${movesName}, as the line:`,
    );
    console.error('  name old-repository new-repository');
  }
  return 1;
};

const main = () => {
  if (yaml === null) {
    return cannotRun([
      'cannot load the yaml package, which reads the lockfile: run',
      'pnpm install --frozen-lockfile in this checkout first',
    ]);
  }

  const [flag, named, ...rest] = process.argv.slice(2);
  const ref = flag === undefined ? 'HEAD^' : named;
  if ((flag !== undefined && flag !== '--base') || rest.length > 0 || !ref) {
    return cannotRun(['usage: scripts/check-provenance.mjs [--base <ref>]']);
  }

  const head = readLock(() => readFileSync(lockPath, 'utf8'));
  if (head === null) {
    return cannotRun([
      `cannot read ${lockPath} as YAML: run this from a checkout of the`,
      'repository, on a lockfile pnpm wrote',
    ]);
  }

  const catalog = catalogVersions(head);
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

  const resolutions = catalogResolutions(head);
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

  const baseLock = readLock(() => lockAt(ref));
  const baseCatalog = baseLock === null ? new Map() : catalogVersions(baseLock);
  if (baseCatalog.size === 0) {
    return cannotRun([
      `no catalog in ${lockName} at ${ref}, which is the baseline this`,
      'compares against: check out enough history to reach it',
    ]);
  }

  // The base versions of the packages this commit moved. A package at one
  // version on both sides is one artifact, so auditing it twice would put
  // the same question to the registry and take the same answer back.
  const base = new Map(
    [...catalog]
      .filter(
        ([name, version]) =>
          baseCatalog.has(name) && baseCatalog.get(name) !== version,
      )
      .map(([name]) => [name, baseCatalog.get(name)]),
  );

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
  let baseAudited = null;
  try {
    probed =
      attempt(() => {
        writeProbeTree(join(root, 'head'), catalog);
        if (base.size > 0) writeProbeTree(join(root, 'base'), base);
        return true;
      }) === true;
    if (probed) audited = audit(join(root, 'head'));
    if (audited !== null && base.size > 0)
      baseAudited = audit(join(root, 'base'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  if (!probed) {
    return cannotRun([
      `cannot write the tree npm audits under ${tmpdir()}, so nothing was verified`,
    ]);
  }

  if (audited === null || (base.size > 0 && baseAudited === null)) {
    return cannotRun([
      'npm audit signatures answered no verification, twice.',
      'The registry or the sigstore trust root was out of reach, so',
      'nothing was verified and no provenance claim is made either way.',
    ]);
  }

  return check({
    catalog,
    attested: attestedSources(catalog, audited),
    audited,
    base,
    baseAttested:
      baseAudited === null ? new Map() : attestedSources(base, baseAudited),
  });
};

process.exitCode = main();
