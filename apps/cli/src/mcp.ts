import type { McpServerFactory } from '@modelcontextprotocol/server';
import {
  StdioServerTransport,
  serveStdio,
} from '@modelcontextprotocol/server/stdio';
import {
  createSaerskrivenServer,
  openWorkspace,
  renderWorkspaceFailure,
  type RasterizerAssets,
} from '@saerskriven/mcp';
import { Either } from 'effect';
import type { Readable, Writable } from 'node:stream';
import { z } from 'zod';
import { runtimeAssets, type WasmAssets } from './assets.js';
import { processStopped, serveHttp, type HttpHost } from './mcp-http.js';
import { pngAssets } from './png.js';
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
 * the server. `--port` defaults to one the system picks, and it and
 * `--token-file` are refused without `--http`.
 */
export const mcpOptionsSchema = z
  .object({
    root: z.string().default(() => process.cwd()),
    file: z.string().optional(),
    http: z.boolean().default(false),
    port: z.coerce.number().int().min(0).max(65_535).optional(),
    tokenFile: z.string().optional(),
  })
  .refine((options) => options.http || options.port === undefined, {
    path: ['port'],
    message: 'is given without --http',
  })
  .refine((options) => options.http || options.tokenFile === undefined, {
    path: ['token-file'],
    message: 'is given without --http',
  });

/** The options an `mcp` invocation was given. */
export type McpOptions = z.infer<typeof mcpOptionsSchema>;

/**
 * Where one server gets its rasterizer. It holds bytes it read, but not a
 * refusal, so an install repaired under a long-lived host is read again.
 */
export function rasterizerIn(assets: string): RasterizerAssets {
  let found: WasmAssets | undefined;
  return () => {
    if (found !== undefined) {
      return Either.right(found);
    }
    const read = pngAssets(assets);
    if (Either.isRight(read)) {
      found = read.right;
    }
    return read;
  };
}

/**
 * The process as a server sees it: the streams stdio carries the protocol
 * over, and what the HTTP server reports through and stops on.
 */
export type McpHost = HttpHost & {
  readonly input: Readable;
  readonly output: Writable;
};

/** The running process's standard streams and signals. */
export function processHost(): McpHost {
  return {
    input: process.stdin,
    output: process.stdout,
    report: (text) => {
      process.stderr.write(text);
    },
    stopped: processStopped,
  };
}

/**
 * `saer mcp`: the MCP server over stdio until the host closes the input, or
 * with `--http` over Streamable HTTP until the process is signalled. Over
 * stdio, standard output carries the protocol alone, so what the transport
 * reported goes to standard error once the connection is over. Both eras of
 * client are served over both transports.
 *
 * `assets` is where a render tool reads the rasterizer module and its faces,
 * which is the directory beside the bundle unless a spec names another.
 */
export function serveMcp(
  options: McpOptions,
  host: McpHost = processHost(),
  assets: string = runtimeAssets,
): Promise<CommandOutcome> {
  return Either.match(openWorkspace(options), {
    onLeft: (failure) =>
      Promise.resolve(usageError(lines(...renderWorkspaceFailure(failure)))),
    onRight: (workspace) => {
      const rasterizer = rasterizerIn(assets);
      const factory: McpServerFactory = () =>
        createSaerskrivenServer({ workspace, version: cliVersion, rasterizer });
      return options.http
        ? serveHttp(
            factory,
            { port: options.port ?? 0, tokenFile: options.tokenFile },
            host,
          )
        : servedOverStdio(factory, host);
    },
  });
}

async function servedOverStdio(
  factory: McpServerFactory,
  host: McpHost,
): Promise<CommandOutcome> {
  const reported: string[] = [];
  const handle = serveStdio(factory, {
    transport: new StdioServerTransport(host.input, host.output),
    legacy: 'serve',
    onerror: (error) => {
      reported.push(`error: ${error.message}`);
    },
  });
  await ended(host.input);
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
