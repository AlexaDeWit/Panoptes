import { Command } from 'commander';
import {
  lines,
  succeeded,
  usageError,
  type CommandOutcome,
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
  request: Request;
};

/** Where the edge puts what a command produced. */
export type CliStreams = {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
};

/**
 * The arguments as the outcome they ask for. Commander tokenizes argv and
 * writes its own help and usage text, and it is held to that: what it
 * recognizes becomes a typed request, the request runs after parsing is
 * over, and a command is reached with typed arguments alone. Commander
 * reports by exiting, which `exitOverride` turns into a value here, so
 * `--version` and `--help` come back as text with code 0 and everything
 * else it refuses comes back as code 2. The request a parse leaves behind
 * is the one that runs, and the value it starts as covers a parse that
 * dispatches nothing, which is a state commander does not reach.
 */
export function runCli(argv: readonly string[]): CommandOutcome {
  const state: ParseState = {
    out: '',
    err: '',
    exitCode: 1,
    request: { kind: 'usage', text: lines('error: no command given.') },
  };
  try {
    programFor(state).parse([...argv], { from: 'user' });
  } catch {
    return state.exitCode === 0
      ? succeeded(state.out, state.err)
      : usageError(state.err);
  }
  return outcomeOf(state.request);
}

/**
 * An outcome onto the streams, giving back the code the process is to exit
 * with. Both texts are written as they are, so nothing is added to a
 * document a command wrote to standard output.
 */
export function writeOutcome(
  outcome: CommandOutcome,
  streams: CliStreams,
): ExitCode {
  streams.out(outcome.out);
  streams.err(outcome.err);
  return outcome.code;
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
    .option('--format <format>', 'svg or md')
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

function outcomeOf(request: Request): CommandOutcome {
  return request.kind === 'validate'
    ? validate(request.file)
    : request.kind === 'render'
      ? render(request.file, request.options)
      : usageError(request.text);
}
