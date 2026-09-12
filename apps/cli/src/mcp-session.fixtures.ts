import {
  Client,
  StreamableHTTPClientTransport,
  type Transport,
} from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import type { Era } from '@saerskriven/mcp/fixtures';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repositoryRoot, type Runner } from './runners.fixtures.js';

/** A client joined to one runner's `saer mcp`, and how to end the session. */
export type McpSession = {
  readonly client: Client;
  readonly end: () => Promise<void>;
};

/** A way of opening a session against a runner, named for a suite title. */
export type SessionOpener = {
  readonly name: string;
  readonly open: (
    runner: Runner,
    args: readonly string[],
    era?: Era,
  ) => Promise<McpSession>;
};

/**
 * A client connected to `saer mcp` over a spawned process's stdio. `era`
 * decides the opening: `legacy` is the 2025 `initialize` handshake and
 * `modern` probes with `server/discover` first.
 */
export async function stdioSession(
  runner: Runner,
  args: readonly string[],
  era: Era = 'modern',
): Promise<McpSession> {
  const transport = new StdioClientTransport({
    command: runner.command,
    args: [...runner.leading, ...args],
    cwd: repositoryRoot,
    stderr: 'inherit',
  });
  return connected(transport, era, () => Promise.resolve());
}

/** A spawned `saer mcp --http`, once it has announced its address. */
export type HttpProcess = {
  readonly url: URL;
  readonly tokenFile: string;
  readonly stop: () => Promise<{
    readonly code: number | null;
    readonly signal: NodeJS.Signals | null;
    readonly out: string;
    readonly err: string;
  }>;
};

/**
 * `saer mcp --http` spawned with a fresh token file, its address read from
 * standard error. Stopping it sends SIGTERM and resolves with the exit code
 * and everything the process wrote.
 */
export async function httpProcess(
  runner: Runner,
  args: readonly string[],
): Promise<HttpProcess> {
  const directory = mkdtempSync(join(tmpdir(), 'saerskriven-cli-http-'));
  const tokenFile = join(directory, 'token');
  const child = spawn(
    runner.command,
    [...runner.leading, ...args, '--http', '--token-file', tokenFile],
    { cwd: repositoryRoot, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const written = { out: '', err: '' };
  child.stdout?.on('data', (chunk: Buffer) => {
    written.out += chunk.toString('utf8');
  });
  const url = await announcedUrl(child, written);
  return {
    url: new URL(url),
    tokenFile,
    stop: async () => {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
      rmSync(directory, { recursive: true, force: true });
      return { code: child.exitCode, signal: child.signalCode, ...written };
    },
  };
}

/**
 * A client connected to `saer mcp --http` over Streamable HTTP, carrying the
 * token read from the file the server wrote.
 */
export async function httpSession(
  runner: Runner,
  args: readonly string[],
  era: Era = 'modern',
): Promise<McpSession> {
  const server = await httpProcess(runner, args);
  const token = readFileSync(server.tokenFile, 'utf8');
  const transport = new StreamableHTTPClientTransport(server.url, {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  return connected(transport, era, async () => {
    await server.stop();
  });
}

/** Both transports a release serves the protocol over. */
export const sessionOpeners: readonly SessionOpener[] = [
  { name: 'stdio', open: stdioSession },
  { name: 'Streamable HTTP', open: httpSession },
];

function announcedUrl(
  child: ChildProcess,
  written: { err: string },
): Promise<string> {
  return new Promise((resolve, reject) => {
    child.stderr?.on('data', (chunk: Buffer) => {
      written.err += chunk.toString('utf8');
      const found = /^MCP server at (\S+)$/m.exec(written.err)?.[1];
      if (found !== undefined) {
        resolve(found);
      }
    });
    child.once('exit', (code) => {
      reject(
        new Error(
          `saer mcp --http exited ${code} before listening: ${written.err}`,
        ),
      );
    });
  });
}

async function connected(
  transport: Transport,
  era: Era,
  after: () => Promise<void>,
): Promise<McpSession> {
  const client = new Client(
    { name: 'saerskriven-harness', version: '0.0.0-spec' },
    { versionNegotiation: { mode: era === 'modern' ? 'auto' : 'legacy' } },
  );
  await client.connect(transport);
  return {
    client,
    end: async () => {
      await client.close();
      await after();
    },
  };
}
