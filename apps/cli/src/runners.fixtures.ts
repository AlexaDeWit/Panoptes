import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cliVersion } from './version.js';

/**
 * One way of running the packaged CLI: the command to spawn, the arguments
 * that come before the invocation's own, and why it cannot be run here, which
 * is nothing where it can.
 */
export type Runner = {
  readonly name: string;
  readonly command: string;
  readonly leading: readonly string[];
  readonly absence: string | undefined;
};

/** The checkout, which every runner is spawned with as its working directory. */
export const repositoryRoot = join(import.meta.dirname, '../../..');

/** Where the esbuild target writes the bundle a runner runs under node. */
export const bundlePath = join(repositoryRoot, 'apps/cli/dist/saer.js');

const hostTarget = (): string | undefined => {
  const probe = spawnSync('deno', ['eval', 'console.log(Deno.build.target)'], {
    encoding: 'utf8',
  });
  return probe.status === 0 ? probe.stdout.trim() : undefined;
};

/** Where the packaging script writes the executable for this host. */
export const executablePath = join(
  repositoryRoot,
  'dist/cli',
  `saer-${cliVersion}-${hostTarget() ?? 'unknown-host-target'}`,
);

/** The bundle the esbuild target writes, run under node. */
export const bundleRunner: Runner = {
  name: 'the bundle under node',
  command: process.execPath,
  leading: [bundlePath],
  absence: undefined,
};

/** The standalone executable the packaging script compiles for this host. */
export const compiledRunner: Runner = {
  name: 'the compiled executable',
  command: executablePath,
  leading: [],
  absence: existsSync(executablePath)
    ? undefined
    : `nothing is at ${executablePath}, which pnpm nx compile @saerskriven/cli writes`,
};

/**
 * Both ways a release is run: the bundle under node, and the executable
 * `deno compile` produced. A spec that names this table covers both, and
 * skips the compiled one where the packaging target has not run.
 */
export const runners: readonly Runner[] = [bundleRunner, compiledRunner];

/** What a suite over one runner is called, saying why it is skipped where it is. */
export function titleOf(runner: Runner, what: string): string {
  return runner.absence === undefined
    ? `${what}, run as ${runner.name}`
    : `${what}, run as ${runner.name}, skipped because ${runner.absence}`;
}

/** One invocation of a runner, with its streams as the bytes it wrote. */
export function ran(runner: Runner, args: readonly string[]) {
  const result = spawnSync(runner.command, [...runner.leading, ...args], {
    cwd: repositoryRoot,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

/** One invocation of a runner, with its streams read as UTF-8. */
export function text(runner: Runner, args: readonly string[]) {
  const result = ran(runner, args);
  return {
    code: result.code,
    out: result.out.toString('utf8'),
    err: result.err.toString('utf8'),
  };
}

/**
 * How long a spec that runs the packaged CLI is given, past the root
 * `vitest.shared.mts` sets. Such a spec spawns node on the bundle, so it
 * pays for a process start and the bundle's whole import graph before an
 * argument is parsed. Ten runs of the whole workspace's suites on a
 * contended host stopped one of these at the root, where the same test takes
 * about a second and a half on an unloaded runner.
 */
export const spawnTimeout = 30_000;
