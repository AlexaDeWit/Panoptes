#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';

import { Either } from 'effect';
import { z } from 'zod';
import {
  ReleaseFailure,
  attempt,
  attemptPromise,
  describeFailure,
  refuse,
  parseJson,
  runProcess,
  requireStatus,
  outputOf,
  runChecked,
  githubJson,
  type CommandResult,
  type RunCommand,
} from './release-io.mts';

export { ReleaseFailure };
export type { CommandResult, RunCommand };

type CommonOptions = Readonly<{
  cwd: string;
  dryRun: boolean;
  input: string | undefined;
  readVersion?: (cwd: string) => Either.Either<string, ReleaseFailure>;
  run?: RunCommand;
}>;

type TagOptions = CommonOptions &
  Readonly<{
    confirm?: (tag: string) => Promise<boolean>;
    write?: (message: string) => void;
  }>;

const releaseVersionSchema = z
  .string()
  .regex(/^(?:v)?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/)
  .transform((input) => input.replace(/^v/u, ''))
  .transform((version) => ({ tag: `v${version}`, version }));
type ReleaseVersion = z.output<typeof releaseVersionSchema>;
const packageManifestSchema = z.object({ version: z.string() });
type PackageManifest = z.output<typeof packageManifestSchema>;
const repositorySchema = z.object({ full_name: z.string() });
const rulesetsSchema = z.array(
  z.object({
    enforcement: z.string(),
    id: z.number(),
    name: z.string(),
    target: z.string(),
  }),
);
const tagRulesetSchema = z.object({
  bypass_actors: z.array(z.unknown()),
  current_user_can_bypass: z.string(),
  enforcement: z.string(),
  rules: z.array(z.object({ type: z.string() })),
});
const checkRunsSchema = z.object({
  check_runs: z.array(
    z.object({
      conclusion: z.string().nullable(),
      id: z.number(),
      name: z.string(),
      status: z.string(),
    }),
  ),
});
const actionSchema = z.enum(['prepare', 'tag']);
const expectedTagRules = [
  'deletion',
  'non_fast_forward',
  'required_signatures',
  'update',
];

/** Parse the stable version stated by the release operator. */
export const parseReleaseVersion = (
  input: string | undefined,
): Either.Either<ReleaseVersion, ReleaseFailure> => {
  const parsed = releaseVersionSchema.safeParse(input);
  return parsed.success
    ? Either.right(parsed.data)
    : Either.left(ReleaseFailure.InvalidVersion({ input: input ?? '' }));
};

const manifestPaths = (cwd: string): Either.Either<string[], ReleaseFailure> =>
  attempt('workspace manifests', () => {
    const paths = ['package.json'];
    for (const parent of ['apps', 'packages']) {
      for (const entry of readdirSync(join(cwd, parent), {
        withFileTypes: true,
      })) {
        const relative = join(parent, entry.name, 'package.json');
        if (entry.isDirectory() && existsSync(join(cwd, relative))) {
          paths.push(relative);
        }
      }
    }
    return paths.toSorted();
  });

const readManifest = (
  cwd: string,
  path: string,
): Either.Either<PackageManifest, ReleaseFailure> =>
  Either.flatMap(
    attempt(path, () => readFileSync(join(cwd, path), 'utf8')),
    (text) => parseJson({ schema: packageManifestSchema }, text, path),
  );

/** Read and compare the root and project manifest versions. */
export const readWorkspaceVersion = (
  cwd: string,
): Either.Either<string, ReleaseFailure> =>
  Either.gen(function* () {
    const paths = yield* manifestPaths(cwd);
    const versions: Array<readonly [string, string]> = [];
    for (const path of paths) {
      const manifest = yield* readManifest(cwd, path);
      versions.push([path, manifest.version]);
    }
    const root = versions.find(([path]) => path === 'package.json')?.[1];
    if (root === undefined)
      return yield* refuse('the root manifest has no version');
    const mismatches = versions.filter(([, version]) => version !== root);
    if (mismatches.length > 0) {
      return yield* refuse(
        `workspace manifest versions disagree: ${mismatches
          .map(([path, version]) => `${path} carries ${version}, not ${root}`)
          .join(', ')}`,
      );
    }
    return root;
  });

const githubRepository = (
  remote: string,
): Either.Either<string, ReleaseFailure> => {
  const prefixes = [
    'git@github.com:',
    'https://github.com/',
    'ssh://git@github.com/',
  ];
  const prefix = prefixes.find((candidate) => remote.startsWith(candidate));
  const repository = prefix
    ? remote.slice(prefix.length).replace(/\.git$/u, '')
    : '';
  return /^[^/]+\/[^/]+$/u.test(repository)
    ? Either.right(repository)
    : refuse('could not read an owner/name GitHub repository from origin');
};

const newest = <Value extends { readonly id: number }>(
  values: Value[],
): Value | undefined =>
  values.reduce<Value | undefined>(
    (latest, value) =>
      latest === undefined || value.id > latest.id ? value : latest,
    undefined,
  );

const assertTagRules = (
  run: RunCommand,
  repository: string,
  cwd: string,
): Either.Either<void, ReleaseFailure> =>
  Either.gen(function* () {
    const rulesets = yield* githubJson(
      run,
      `repos/${repository}/rulesets`,
      cwd,
      { schema: rulesetsSchema },
    );
    const matches = rulesets.filter(
      (ruleset) =>
        ruleset.target === 'tag' &&
        ruleset.name === 'Tag Integrity' &&
        ruleset.enforcement === 'active',
    );
    if (matches.length !== 1) {
      return yield* refuse(
        'the active Tag Integrity ruleset is absent or ambiguous',
      );
    }
    const ruleset = yield* githubJson(
      run,
      `repos/${repository}/rulesets/${String(matches[0]?.id)}`,
      cwd,
      { schema: tagRulesetSchema },
    );
    const rules = ruleset.rules.map(({ type }) => type).toSorted();
    const ready =
      ruleset.enforcement === 'active' &&
      ruleset.bypass_actors.length === 0 &&
      ruleset.current_user_can_bypass === 'never' &&
      JSON.stringify(rules) === JSON.stringify(expectedTagRules);
    return ready
      ? undefined
      : yield* refuse(
          'Tag Integrity does not enforce signed, fixed tags with an empty bypass list. Restore it before releasing',
        );
  });

const assertCiGate = (
  run: RunCommand,
  repository: string,
  commit: string,
  cwd: string,
): Either.Either<string, ReleaseFailure> =>
  Either.gen(function* () {
    const checks = yield* githubJson(
      run,
      `repos/${repository}/commits/${commit}/check-runs?per_page=100`,
      cwd,
      { schema: checkRunsSchema },
    );
    const gate = newest(
      checks.check_runs.filter(({ name }) => name === 'CI gate'),
    );
    const gateState = gate
      ? `${gate.status}/${gate.conclusion ?? 'none'}`
      : 'absent';
    if (gateState !== 'completed/success') {
      return yield* refuse(
        `the 'CI gate' check on ${commit} is '${gateState}', not completed/success`,
      );
    }
    return gateState;
  });

const assertCleanBranch = (
  run: RunCommand,
  cwd: string,
  expected: string,
): Either.Either<void, ReleaseFailure> =>
  Either.gen(function* () {
    const status = yield* outputOf(run, 'git', ['status', '--porcelain'], cwd);
    if (status !== '') return yield* refuse('the working tree has changes');
    const branch = yield* outputOf(
      run,
      'git',
      ['symbolic-ref', '--quiet', '--short', 'HEAD'],
      cwd,
    );
    return branch === expected
      ? undefined
      : yield* refuse(`on branch '${branch}'. Use ${expected}`);
  });

/** Write and format the files for a release pull request. */
export const prepareRelease = ({
  cwd,
  dryRun,
  input,
  readVersion = readWorkspaceVersion,
  run = runProcess,
}: CommonOptions): Either.Either<string, ReleaseFailure> =>
  Either.gen(function* () {
    const { tag, version } = yield* parseReleaseVersion(input);
    yield* assertCleanBranch(run, cwd, `release-${tag}`);
    if (dryRun) {
      yield* runChecked(
        run,
        'pnpm',
        ['nx', 'release', 'version', '--dry-run'],
        cwd,
      );
      return 'DRY_RUN=1, nothing changed';
    }
    yield* runChecked(run, 'pnpm', ['nx', 'release', 'version'], cwd);
    const workspaceVersion = yield* readVersion(cwd);
    if (workspaceVersion !== version) {
      return yield* refuse(
        `Nx derived '${workspaceVersion}', not the stated '${version}'`,
      );
    }
    yield* runChecked(
      run,
      'pnpm',
      ['nx', 'release', 'changelog', version],
      cwd,
    );
    yield* runChecked(run, 'pnpm', ['exec', 'oxfmt', 'CHANGELOG.md'], cwd);
    yield* runChecked(run, 'pnpm', ['format:check'], cwd);
    return `prepared ${tag}. Review the diff, then run pnpm check.`;
  });

const promptForTag = async (tag: string): Promise<boolean> => {
  if (!process.stdin.isTTY) return false;
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const controller = new AbortController();
  const abort = (): void => {
    controller.abort();
  };
  process.once('SIGINT', abort);
  try {
    const reply = await terminal.question(
      `\nPushing ${tag} starts the release and cannot be undone. Type the tag to confirm: `,
      { signal: controller.signal },
    );
    return reply === tag;
  } catch {
    return false;
  } finally {
    process.removeListener('SIGINT', abort);
    terminal.close();
  }
};

type TagContext = Readonly<{
  commit: string;
  repository: string;
  gate: string;
  subject: string;
  tag: string;
  version: string;
}>;

const tagPreflight = ({
  cwd,
  input,
  readVersion = readWorkspaceVersion,
  run = runProcess,
}: CommonOptions): Either.Either<TagContext, ReleaseFailure> =>
  Either.gen(function* () {
    const { tag, version } = yield* parseReleaseVersion(input);
    const workspaceVersion = yield* readVersion(cwd);
    if (workspaceVersion !== version) {
      return yield* refuse(
        `version '${version}' does not match workspace version '${workspaceVersion}'`,
      );
    }
    yield* assertCleanBranch(run, cwd, 'main');
    yield* runChecked(run, 'git', ['fetch', '--quiet', 'origin', 'main'], cwd);
    const commit = yield* outputOf(run, 'git', ['rev-parse', 'HEAD'], cwd);
    const originCommit = yield* outputOf(
      run,
      'git',
      ['rev-parse', 'origin/main'],
      cwd,
    );
    if (commit !== originCommit) {
      return yield* refuse(
        `HEAD (${commit}) is not origin/main (${originCommit})`,
      );
    }
    const remote = yield* outputOf(
      run,
      'git',
      ['remote', 'get-url', 'origin'],
      cwd,
    );
    const remoteRepository = yield* githubRepository(remote);
    const repository = (yield* githubJson(
      run,
      `repos/${remoteRepository}`,
      cwd,
      { schema: repositorySchema },
    )).full_name;
    yield* assertTagRules(run, repository, cwd);
    const gate = yield* assertCiGate(run, repository, commit, cwd);
    const localTagArgs = ['rev-parse', '-q', '--verify', `refs/tags/${tag}`];
    const localTag = yield* requireStatus(
      run('git', localTagArgs, { cwd }),
      [0, 1],
      'git',
      localTagArgs,
    );
    if (localTag.status === 0) {
      return yield* refuse(`tag ${tag} already exists locally`);
    }
    const remoteTagArgs = [
      'ls-remote',
      '--exit-code',
      '--tags',
      'origin',
      `refs/tags/${tag}`,
    ];
    const remoteTag = yield* requireStatus(
      run('git', remoteTagArgs, { cwd }),
      [0, 2],
      'git',
      remoteTagArgs,
    );
    if (remoteTag.status === 0) {
      return yield* refuse(`tag ${tag} already exists on origin`);
    }
    yield* runChecked(
      run,
      join(cwd, 'scripts', 'check-provenance.mjs'),
      [],
      cwd,
    );
    const subject = yield* outputOf(
      run,
      'git',
      ['log', '-1', '--format=%s', commit],
      cwd,
    );
    return {
      commit,
      repository,
      gate,
      subject,
      tag,
      version: workspaceVersion,
    };
  });

const removeLocalTag = (
  run: RunCommand,
  cwd: string,
  tag: string,
  failure: ReleaseFailure,
): Either.Either<never, ReleaseFailure> => {
  const removed = requireStatus(
    run('git', ['tag', '-d', tag], { cwd }),
    [0],
    'git',
    ['tag', '-d', tag],
  );
  return Either.isLeft(removed)
    ? refuse(
        `${describeFailure(failure)}. The local tag ${tag} also could not be removed`,
      )
    : Either.left(failure);
};

/** Check the release commit, then sign and push its tag after confirmation. */
export const tagRelease = async ({
  confirm = promptForTag,
  cwd,
  dryRun,
  input,
  readVersion = readWorkspaceVersion,
  run = runProcess,
  write = (message: string): void => {
    process.stdout.write(message);
  },
}: TagOptions): Promise<Either.Either<string, ReleaseFailure>> => {
  const context = tagPreflight({ cwd, dryRun, input, readVersion, run });
  if (Either.isLeft(context)) return Either.left(context.left);
  const { commit, repository, gate, subject, tag, version } = context.right;
  const wrote = attempt('release plan', () => {
    write(
      `\n  tag         ${tag}\n  repository  ${repository}\n  commit      ${commit}\n` +
        `  subject     ${subject}\n  manifests   ${version}\n` +
        `  CI gate     ${gate}\n` +
        '  provenance  passed\n  tag rules   enforced\n\n',
    );
  });
  if (Either.isLeft(wrote)) return Either.left(wrote.left);
  if (dryRun) return Either.right('DRY_RUN=1, nothing created or pushed');
  const created = runChecked(
    run,
    'git',
    ['tag', '-s', tag, '-m', tag, commit],
    cwd,
  );
  if (Either.isLeft(created)) return Either.left(created.left);
  let tagCreated = true;
  const cleanupOnExit = (): void => {
    if (tagCreated) {
      spawnSync('git', ['tag', '-d', tag], { cwd, stdio: 'ignore' });
    }
  };
  process.once('exit', cleanupOnExit);
  try {
    const verified = runChecked(run, 'git', ['tag', '-v', tag], cwd);
    if (Either.isLeft(verified)) {
      return removeLocalTag(run, cwd, tag, verified.left);
    }
    const tagged = outputOf(run, 'git', ['rev-parse', `${tag}^{commit}`], cwd);
    if (Either.isLeft(tagged)) {
      return removeLocalTag(run, cwd, tag, tagged.left);
    }
    if (tagged.right !== commit) {
      return removeLocalTag(
        run,
        cwd,
        tag,
        ReleaseFailure.Refused({
          reason: `the tag landed on ${tagged.right}, not the checked commit ${commit}`,
        }),
      );
    }
    const confirmed = await attemptPromise('release confirmation', () =>
      confirm(tag),
    );
    if (Either.isLeft(confirmed)) {
      return removeLocalTag(run, cwd, tag, confirmed.left);
    }
    if (!confirmed.right) {
      return removeLocalTag(
        run,
        cwd,
        tag,
        ReleaseFailure.Refused({ reason: 'not confirmed. Nothing was pushed' }),
      );
    }
    const pushed = runChecked(run, 'git', ['push', 'origin', tag], cwd);
    if (Either.isLeft(pushed)) {
      return removeLocalTag(run, cwd, tag, pushed.left);
    }
    tagCreated = false;
    return Either.right(
      `pushed ${tag}. CI will build, attest, and publish the executables.`,
    );
  } finally {
    process.removeListener('exit', cleanupOnExit);
  }
};

const main = async (): Promise<void> => {
  const [givenAction, ...rest] = process.argv.slice(2);
  const action = actionSchema.safeParse(givenAction);
  const invalidInvocation =
    !action.success ||
    rest.length > 0 ||
    process.env.RELEASE_VERSION === undefined;
  const outcome = invalidInvocation
    ? Either.left(
        ReleaseFailure.Refused({
          reason:
            'usage: RELEASE_VERSION=vX.Y.Z pnpm nx run release-tools:<prepare|tag>',
        }),
      )
    : action.data === 'prepare'
      ? prepareRelease({
          cwd: process.cwd(),
          dryRun: process.env.DRY_RUN === '1',
          input: process.env.RELEASE_VERSION,
        })
      : await tagRelease({
          cwd: process.cwd(),
          dryRun: process.env.DRY_RUN === '1',
          input: process.env.RELEASE_VERSION,
        });
  Either.match(outcome, {
    onLeft: (failure) => {
      process.stderr.write(`release: ${describeFailure(failure)}\n`);
      process.exitCode = 1;
    },
    onRight: (message) => {
      process.stdout.write(`release: ${message}\n`);
    },
  });
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
