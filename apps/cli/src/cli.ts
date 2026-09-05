import { Command } from 'commander';
import { Either } from 'effect';
import { reasonOf } from './files.js';
import {
  lines,
  succeeded,
  usageError,
  type CommandOutcome,
  type CommandOutput,
  type ExitCode,
} from './outcome.js';
import { render, renderOptionsSchema, type RenderOptions } from './render.js';
import { validate } from './validate.js';
import { cliVersion } from './version.js';

type Request =
  | { readonly kind: 'validate'; readonly file: string }
  | {
      readonly kind: 'render';
      readonly file: string;
      readonly options: RenderOptions;
    }
  | { readonly kind: 'usage'; readonly text: string };

type ParseState = {
  out: string;
  err: string;
  exitCode: number;
  request: Request | undefined;
};

/**
 * Where the edge puts what a command produced. A write comes back as the
 * system's reason where the stream would not take the text.
 */
export type CliStreams = {
  readonly out: (output: CommandOutput) => Either.Either<void, string>;
  readonly err: (text: string) => Either.Either<void, string>;
};

/**
 * The arguments as the outcome they ask for. Commander reports by exiting,
 * which `exitOverride` turns into a value here, and what it recognizes
 * becomes a typed request that runs once parsing is over, so a command is
 * reached with typed arguments alone. Parsing is synchronous; the answer is
 * a promise because one projection, the PDF, is.
 */
export function runCli(argv: readonly string[]): Promise<CommandOutcome> {
  const state: ParseState = {
    out: '',
    err: '',
    exitCode: 1,
    request: undefined,
  };
  try {
    programFor(state).parse([...argv], { from: 'user' });
  } catch (error) {
    return Promise.resolve(parseStopped(state, error));
  }
  return state.request === undefined
    ? Promise.resolve(usageError(state.err))
    : outcomeOf(state.request);
}

/**
 * An outcome onto the streams, giving back the code the process is to exit
 * with. Both texts are written as they are, so nothing is added to a
 * document a command wrote to standard output. A stream that will not take
 * its text exits 2: standard output's reason is reported on standard error,
 * and standard error's has nowhere left to go.
 */
export function writeOutcome(
  outcome: CommandOutcome,
  streams: CliStreams,
): ExitCode {
  return Either.match(streams.out(outcome.out), {
    onLeft: (reason) => lostOutput(streams, reason),
    onRight: () =>
      Either.match(streams.err(outcome.err), {
        onLeft: (): ExitCode => 2,
        onRight: () => outcome.code,
      }),
  });
}

function lostOutput(streams: CliStreams, reason: string): ExitCode {
  streams.err(lines(`error: cannot write to standard output: ${reason}`));
  return 2;
}

function parseStopped(state: ParseState, error: unknown): CommandOutcome {
  return state.exitCode === 0
    ? succeeded(state.out, state.err)
    : usageError(
        state.err === '' ? lines(`error: ${reasonOf(error)}`) : state.err,
      );
}

function programFor(state: ParseState): Command {
  const program = new Command()
    .name('panoptes')
    .description('Threat models on the command line.')
    .version(cliVersion)
    .exitOverride((error) => {
      state.exitCode = error.exitCode;
      throw error;
    })
    .configureOutput({
      writeOut: (text) => {
        state.out += text;
      },
      writeErr: (text) => {
        state.err += text;
      },
    });
  program
    .command('validate')
    .description('read a model file and report what it holds')
    .argument('<file>', 'the model file to read')
    .action((file: string) => {
      state.request = { kind: 'validate', file };
    });
  program
    .command('render')
    .description('write a projection of a model file')
    .argument('<file>', 'the model file to read')
    .option('--format <format>', 'svg, md or pdf')
    .option('--out <path>', 'the file to write, or - for standard output')
    .option('--diagram <id or title>', 'the diagram to draw, for --format svg')
    .action((file: string, options: unknown) => {
      state.request = renderRequest(file, options);
    });
  return program;
}

function renderRequest(file: string, options: unknown): Request {
  const parsed = renderOptionsSchema.safeParse(options);
  return parsed.success
    ? { kind: 'render', file, options: parsed.data }
    : {
        kind: 'usage',
        text: lines(
          ...parsed.error.issues.map(
            (issue) => `error: --${issue.path.join('.')}: ${issue.message}`,
          ),
        ),
      };
}

function outcomeOf(request: Request): Promise<CommandOutcome> {
  return request.kind === 'validate'
    ? Promise.resolve(validate(request.file))
    : request.kind === 'render'
      ? render(request.file, request.options)
      : Promise.resolve(usageError(request.text));
}
