import { spawnSync } from 'node:child_process';
import { Data, Either } from 'effect';
import { z } from 'zod';

type JsonReader<Output> = Readonly<{ schema: z.ZodType<Output> }>;

/** Process result returned by the release command runner. */
export type CommandResult = Readonly<{
  error?: Error;
  status: number | null;
  stderr: string;
  stdout: string;
}>;

type RunOptions = Readonly<{ cwd: string; inherit?: boolean }>;
/** Injectable runner for operator commands. */
export type RunCommand = (
  command: string,
  args: string[],
  options: RunOptions,
) => CommandResult;

/** Plain failures shared by release operations. */
export type ReleaseFailure = Data.TaggedEnum<{
  CommandFailed: { readonly command: string; readonly reason: string };
  InvalidData: { readonly issues: readonly string[]; readonly source: string };
  InvalidVersion: { readonly input: string };
  Refused: { readonly reason: string };
}>;

/** Constructors for release failures. */
export const ReleaseFailure = Data.taggedEnum<ReleaseFailure>();

const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/** Format a release failure for the operator. */
export const describeFailure = (failure: ReleaseFailure): string =>
  ReleaseFailure.$match(failure, {
    CommandFailed: ({ command, reason }) => `${command}: ${reason}`,
    InvalidData: ({ issues, source }) => `${source}: ${issues.join(', ')}`,
    InvalidVersion: ({ input }) =>
      `'${input}' is not X.Y.Z (a leading 'v' is optional)`,
    Refused: ({ reason }) => reason,
  });

/** Return a release refusal without throwing. */
export const refuse = (reason: string): Either.Either<never, ReleaseFailure> =>
  Either.left(ReleaseFailure.Refused({ reason }));

const invalidData = (
  source: string,
  cause: unknown,
): Either.Either<never, ReleaseFailure> =>
  Either.left(
    ReleaseFailure.InvalidData({ issues: [reasonOf(cause)], source }),
  );

/** Capture a synchronous IO failure as release data. */
export const attempt = <Value,>(
  source: string,
  read: () => Value,
): Either.Either<Value, ReleaseFailure> =>
  Either.try({
    try: read,
    catch: (cause) =>
      ReleaseFailure.InvalidData({ issues: [reasonOf(cause)], source }),
  });

/** Capture an asynchronous IO failure as release data. */
export const attemptPromise = async <Value,>(
  source: string,
  read: () => Promise<Value>,
): Promise<Either.Either<Value, ReleaseFailure>> => {
  try {
    return Either.right(await read());
  } catch (cause: unknown) {
    return invalidData(source, cause);
  }
};

const zodIssues = (issues: z.core.$ZodIssue[]): string[] =>
  issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    return `${path ? `${path}: ` : ''}${issue.message}`;
  });

/** Decode JSON and report schema failures as plain release data. */
export const parseJson = <Output,>(
  reader: JsonReader<Output>,
  text: string,
  source: string,
): Either.Either<Output, ReleaseFailure> =>
  Either.flatMap(
    attempt(source, () => JSON.parse(text) as unknown),
    (value) => {
      const parsed = reader.schema.safeParse(value);
      return parsed.success
        ? Either.right(parsed.data)
        : Either.left(
            ReleaseFailure.InvalidData({
              issues: zodIssues(parsed.error.issues),
              source,
            }),
          );
    },
  );

/** Run a command with captured output or inherited terminal streams. */
export const runProcess: RunCommand = (
  command,
  args,
  { cwd, inherit = false },
) => {
  const processResult = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  return {
    error: processResult.error,
    status: processResult.status,
    stderr: processResult.stderr?.trimEnd() ?? '',
    stdout: processResult.stdout?.trimEnd() ?? '',
  };
};

const commandName = (command: string, args: string[]): string =>
  [command, ...args].join(' ');

/** Accept only the command exit statuses named by the caller. */
export const requireStatus = (
  result: CommandResult,
  allowed: number[],
  command: string,
  args: string[],
): Either.Either<CommandResult, ReleaseFailure> => {
  if (result.error) {
    return Either.left(
      ReleaseFailure.CommandFailed({
        command: commandName(command, args),
        reason: result.error.message,
      }),
    );
  }
  return result.status !== null && allowed.includes(result.status)
    ? Either.right(result)
    : Either.left(
        ReleaseFailure.CommandFailed({
          command: commandName(command, args),
          reason:
            result.stderr || `exited with status ${String(result.status)}`,
        }),
      );
};

/** Read standard output from a successful command. */
export const outputOf = (
  run: RunCommand,
  command: string,
  args: string[],
  cwd: string,
): Either.Either<string, ReleaseFailure> =>
  Either.map(
    requireStatus(run(command, args, { cwd }), [0], command, args),
    ({ stdout }) => stdout,
  );

/** Run a command attached to the terminal and require success. */
export const runChecked = (
  run: RunCommand,
  command: string,
  args: string[],
  cwd: string,
): Either.Either<void, ReleaseFailure> =>
  Either.map(
    requireStatus(
      run(command, args, { cwd, inherit: true }),
      [0],
      command,
      args,
    ),
    () => undefined,
  );

/** Read a GitHub API response through the supplied schema. */
export const githubJson = <Output,>(
  run: RunCommand,
  endpoint: string,
  cwd: string,
  reader: JsonReader<Output>,
): Either.Either<Output, ReleaseFailure> =>
  Either.flatMap(outputOf(run, 'gh', ['api', endpoint], cwd), (text) =>
    parseJson(reader, text, `GitHub ${endpoint}`),
  );
