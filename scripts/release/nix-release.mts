#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Either } from 'effect';
import { z } from 'zod';
import { parseReleaseVersion } from './release.mts';
import {
  attempt,
  describeFailure,
  githubJson,
  parseJson,
  refuse,
  runChecked,
  runProcess,
  type ReleaseFailure,
  type RunCommand,
} from './release-io.mts';

const repository = 'AlexaDeWit/Saerskriven';
const manifestPath = 'nix/release.json';
const systemSchema = z.enum([
  'x86_64-linux',
  'aarch64-linux',
  'x86_64-darwin',
  'aarch64-darwin',
]);
const assetSchema = z.object({
  target: z.enum([
    'x86_64-unknown-linux-gnu',
    'aarch64-unknown-linux-gnu',
    'x86_64-apple-darwin',
    'aarch64-apple-darwin',
  ]),
  hash: z.string().regex(/^[0-9a-f]{64}$/u),
});
const manifestSchema = z.object({
  version: z.string(),
  assets: z.record(systemSchema, assetSchema),
});
const releaseSchema = z.object({
  draft: z.literal(false),
  prerelease: z.literal(false),
  tag_name: z.string(),
});
const objectSchema = z.object({ sha: z.string().regex(/^[0-9a-f]{40}$/u) });
const tagRefSchema = z.object({
  object: objectSchema.extend({ type: z.literal('tag') }),
});
const tagSchema = z.object({
  object: objectSchema.extend({ type: z.literal('commit') }),
});

type UpdateOptions = Readonly<{
  cwd: string;
  input: string | undefined;
  run?: RunCommand;
}>;

const fetchAssetHash = (
  run: RunCommand,
  cwd: string,
  tag: string,
  commit: string,
  path: string,
): Either.Either<string, ReleaseFailure> =>
  Either.gen(function* () {
    yield* runChecked(
      run,
      'gh',
      [
        'release',
        'download',
        tag,
        '--repo',
        repository,
        '--dir',
        dirname(path),
        '--pattern',
        basename(path),
      ],
      cwd,
    );
    yield* runChecked(
      run,
      'gh',
      [
        'attestation',
        'verify',
        path,
        '--repo',
        repository,
        '--signer-workflow',
        `${repository}/.github/workflows/ci.yml`,
        '--source-ref',
        `refs/tags/${tag}`,
        '--source-digest',
        commit,
      ],
      cwd,
    );
    return yield* attempt(path, () =>
      createHash('sha256').update(readFileSync(path)).digest('hex'),
    );
  });

const preparePin = (
  cwd: string,
  input: string | undefined,
  run: RunCommand,
  directory: string,
): Either.Either<string, ReleaseFailure> =>
  Either.gen(function* () {
    const { version, tag } = yield* parseReleaseVersion(input);
    const text = yield* attempt(manifestPath, () =>
      readFileSync(join(cwd, manifestPath), 'utf8'),
    );
    const manifest = yield* parseJson(
      { schema: manifestSchema },
      text,
      manifestPath,
    );
    const release = yield* githubJson(
      run,
      `repos/${repository}/releases/tags/${tag}`,
      cwd,
      { schema: releaseSchema },
    );
    if (release.tag_name !== tag)
      return yield* refuse(`the release response does not name ${tag}`);
    const reference = yield* githubJson(
      run,
      `repos/${repository}/git/ref/tags/${tag}`,
      cwd,
      { schema: tagRefSchema },
    );
    const source = yield* githubJson(
      run,
      `repos/${repository}/git/tags/${reference.object.sha}`,
      cwd,
      { schema: tagSchema },
    );
    for (const asset of Object.values(manifest.assets)) {
      const name = `saerskriven-${version}-${asset.target}`;
      const path = join(directory, name);
      asset.hash = yield* fetchAssetHash(
        run,
        cwd,
        tag,
        source.object.sha,
        path,
      );
    }
    const candidate = join(directory, 'release.json');
    yield* attempt(manifestPath, () => {
      writeFileSync(
        candidate,
        `${JSON.stringify({ ...manifest, version }, null, 2)}\n`,
      );
      renameSync(candidate, join(cwd, manifestPath));
    });
    return `updated ${manifestPath} to ${tag} (${source.object.sha}). Run the Nix package checks before review.`;
  });

/** Verify a published release and replace the Nix pin only after all assets pass. */
export const updateNixRelease = ({
  cwd,
  input,
  run = runProcess,
}: UpdateOptions): Either.Either<string, ReleaseFailure> =>
  Either.gen(function* () {
    yield* parseReleaseVersion(input);
    const directory = yield* attempt(manifestPath, () =>
      mkdtempSync(join(cwd, 'nix', '.release-')),
    );
    const outcome = preparePin(cwd, input, run, directory);
    yield* attempt('release download cleanup', () => {
      rmSync(directory, { recursive: true, force: true });
    });
    return yield* outcome;
  });

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const outcome =
    process.argv.length === 2
      ? updateNixRelease({
          cwd: process.cwd(),
          input: process.env.RELEASE_VERSION,
        })
      : refuse(
          'usage: RELEASE_VERSION=vX.Y.Z pnpm nx run release-tools:update-nix',
        );
  Either.match(outcome, {
    onLeft: (failure) => {
      process.stderr.write(`release: ${describeFailure(failure)}\n`);
      process.exitCode = 1;
    },
    onRight: (message) => {
      process.stdout.write(`release: ${message}\n`);
    },
  });
}
