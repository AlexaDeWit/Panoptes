import { Command } from 'commander';
import { Either } from 'effect';
import type { z } from 'zod';
import { reasonOf } from './files.js';
import {
  installMcp,
  installOptionsSchema,
  type InstallOptions,
} from './mcp-install.js';
import { mcpOptionsSchema, serveMcp, type McpOptions } from './mcp.js';
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
  | { readonly kind: 'mcp'; readonly options: McpOptions }
  | { readonly kind: 'mcp-install'; readonly options: InstallOptions }
  | { readonly kind: 'usage'; readonly text: string };

type ParseState = {
  out: string;
  err: string;
  exitCode: number;
  request: Request | undefined;
};

/** Output streams return a reason when a write fails. */
export type CliStreams = {
  readonly out: (output: CommandOutput) => Either.Either<void, string>;
  readonly err: (text: string) => Either.Either<void, string>;
};

/** Parse arguments and run a command, returning parser errors as outcomes. */
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

/** Write output unchanged and return exit code 2 if either stream fails. */
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
    .name('saer')
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
  validateCommand(program, state);
  renderCommand(program, state);
  mcpCommand(program, state);
  return program;
}

function validateCommand(program: Command, state: ParseState): void {
  program
    .command('validate')
    .description('read a model file and report what it holds')
    .argument('<file>', 'the model file to read')
    .action((file: string) => {
      state.request = { kind: 'validate', file };
    });
}

function renderCommand(program: Command, state: ParseState): void {
  program
    .command('render')
    .description('write a projection of a model file')
    .argument('<file>', 'the model file to read')
    .option('--format <format>', 'svg, png, md or pdf')
    .option('--out <path>', 'the file to write, or - for standard output')
    .option(
      '--diagram <id or title>',
      'the diagram to draw, for --format svg or png',
    )
    .action((file: string, options: unknown) => {
      const parsed = renderOptionsSchema.safeParse(options);
      state.request = parsed.success
        ? { kind: 'render', file, options: parsed.data }
        : refused(parsed.error.issues);
    });
}

function mcpCommand(program: Command, state: ParseState): void {
  const mcp = program
    .command('mcp')
    .description(
      'serve the model context protocol over standard input and output',
    )
    .option(
      '--root <dir>',
      'the directory the server may read, default the working directory',
    )
    .option('--file <path>', 'the model a tool call reads when it names none')
    .action((options: unknown) => {
      const parsed = mcpOptionsSchema.safeParse(options);
      state.request = parsed.success
        ? { kind: 'mcp', options: parsed.data }
        : refused(parsed.error.issues);
    });
  mcp
    .command('install')
    .description("write a host's registration for this server")
    .option(
      '--host <host>',
      'claude-code, claude-desktop, cursor, vscode or codex',
    )
    .option('--project', "write the file the host's project commits")
    .option('--user', "write the host's user-level file")
    .option('--file <path>', 'the model a tool call reads when it names none')
    .option('--print', 'print the entry rather than writing it')
    .action((options: unknown) => {
      const parsed = installOptionsSchema.safeParse(options);
      state.request = parsed.success
        ? { kind: 'mcp-install', options: parsed.data }
        : refused(parsed.error.issues);
    });
}

function refused(issues: readonly z.core.$ZodIssue[]): Request {
  return {
    kind: 'usage',
    text: lines(
      ...issues.map(
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
      : request.kind === 'mcp'
        ? serveMcp(request.options)
        : request.kind === 'mcp-install'
          ? Promise.resolve(installMcp(request.options))
          : Promise.resolve(usageError(request.text));
}
