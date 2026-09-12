import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import type { Era } from '@saerskriven/mcp/fixtures';
import { repositoryRoot, type Runner } from './runners.fixtures.js';

/** A client joined to one runner's `saer mcp`, and how to end the session. */
export type StdioSession = {
  readonly client: Client;
  readonly end: () => Promise<void>;
};

/**
 * A client connected to `saer mcp` over a spawned process, which is how a
 * host runs this server. `era` decides the opening: `legacy` is the 2025
 * `initialize` handshake and `modern` probes with `server/discover` first,
 * so one harness covers both the clients a release has to serve.
 *
 * The server's standard error is inherited rather than piped, so anything it
 * reports lands in the test output instead of filling a pipe nothing drains.
 */
export async function stdioSession(
  runner: Runner,
  args: readonly string[],
  era: Era = 'modern',
): Promise<StdioSession> {
  const transport = new StdioClientTransport({
    command: runner.command,
    args: [...runner.leading, ...args],
    cwd: repositoryRoot,
    stderr: 'inherit',
  });
  const client = new Client(
    { name: 'saerskriven-harness', version: '0.0.0-spec' },
    { versionNegotiation: { mode: era === 'modern' ? 'auto' : 'legacy' } },
  );
  await client.connect(transport);
  return { client, end: () => client.close() };
}
