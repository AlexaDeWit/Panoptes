import {
  StdioServerTransport,
  serveStdio,
} from '@modelcontextprotocol/server/stdio';
import {
  createSaerskrivenServer,
  openWorkspace,
  renderWorkspaceFailure,
  type ModelWorkspace,
} from '@saerskriven/mcp';
import { Either } from 'effect';
import type { Readable, Writable } from 'node:stream';
import { z } from 'zod';
import {
  lines,
  succeeded,
  usageError,
  type CommandOutcome,
} from './outcome.js';
import { cliVersion } from './version.js';

/**
 * What `mcp` needs, and the one gate on the option bag the parser hands over.
 * `--root` defaults to the working directory, which is where a host launches
 * the server.
 */
export const mcpOptionsSchema = z.object({
  root: z.string().default(() => process.cwd()),
  file: z.string().optional(),
});

/** The options an `mcp` invocation was given. */
export type McpOptions = z.infer<typeof mcpOptionsSchema>;

/** Which streams carry the protocol, so a spec can serve over a pair of pipes. */
export type McpStreams = {
  readonly input: Readable;
  readonly output: Writable;
};

/**
 * `saer mcp`: the MCP server over stdio, serving until the host closes the
 * input. Standard output carries the protocol and nothing else, so this
 * outcome writes nothing there and whatever the transport reported goes to
 * standard error once the connection is over. A 2025-era client is served as
 * well as a 2026-07-28 one.
 */
export function serveMcp(
  options: McpOptions,
  streams: McpStreams = { input: process.stdin, output: process.stdout },
): Promise<CommandOutcome> {
  return Either.match(openWorkspace(options), {
    onLeft: (failure) =>
      Promise.resolve(usageError(lines(...renderWorkspaceFailure(failure)))),
    onRight: (workspace) => served(workspace, streams),
  });
}

async function served(
  workspace: ModelWorkspace,
  streams: McpStreams,
): Promise<CommandOutcome> {
  const reported: string[] = [];
  const handle = serveStdio(
    () => createSaerskrivenServer({ workspace, version: cliVersion }),
    {
      transport: new StdioServerTransport(streams.input, streams.output),
      legacy: 'serve',
      onerror: (error) => {
        reported.push(`error: ${error.message}`);
      },
    },
  );
  await ended(streams.input);
  await handle.close();
  return succeeded('', lines(...reported));
}

function ended(input: Readable): Promise<void> {
  return new Promise((resolve) => {
    const settle = (): void => {
      resolve();
    };
    input.once('end', settle);
    input.once('close', settle);
  });
}
