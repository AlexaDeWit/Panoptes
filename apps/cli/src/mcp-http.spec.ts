import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer, request, type OutgoingHttpHeaders } from 'node:http';
import { EventEmitter, once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveMcp, type McpOptions } from './mcp.js';
import type { CommandOutcome } from './outcome.js';

const repositoryRoot = join(import.meta.dirname, '../../..');

type Running = {
  readonly url: URL;
  readonly token: string;
  readonly stop: () => Promise<CommandOutcome>;
};

const started = async (
  options: Partial<McpOptions> = {},
): Promise<Running | CommandOutcome> => {
  const events = new EventEmitter();
  const announcement = once(events, 'reported').then(() => undefined);
  let reported = '';
  const outcome = serveMcp(
    { root: repositoryRoot, http: true, ...options },
    {
      input: process.stdin,
      output: process.stdout,
      report: (text) => {
        reported += text;
        events.emit('reported');
      },
      stopped: () => once(events, 'stop').then(() => undefined),
    },
  );
  const first = await Promise.race([outcome, announcement]);
  if (first !== undefined) {
    return first;
  }
  return {
    url: new URL(/^MCP server at (\S+)$/m.exec(reported)?.[1] ?? ''),
    token: /^Bearer token: (\S+)$/m.exec(reported)?.[1] ?? '',
    stop: () => {
      events.emit('stop');
      return outcome;
    },
  };
};

const running = async (options: Partial<McpOptions> = {}): Promise<Running> => {
  const server = await started(options);
  if (!('url' in server)) {
    expect.fail(`the server did not start: ${server.err}`);
  }
  return server;
};

const discover = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
});

const statusOf = (url: URL, headers: OutgoingHttpHeaders): Promise<number> =>
  new Promise((resolve, reject) => {
    const sent = request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          ...headers,
        },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    sent.once('error', reject);
    sent.end(discover);
  });

describe('saer mcp --http', () => {
  it('listens on 127.0.0.1 and ends with the host, exiting 0', async () => {
    const server = await running();
    expect(server.url.hostname).toEqual('127.0.0.1');
    expect(server.url.pathname).toEqual('/mcp');
    expect(await server.stop()).toEqual({ code: 0, out: '', err: '' });
  });

  it('writes the token it printed to the token file', async () => {
    const tokenFile = join(
      mkdtempSync(join(tmpdir(), 'saerskriven-cli-token-')),
      'token',
    );
    const server = await running({ tokenFile });
    const written = readFileSync(tokenFile, 'utf8');
    await server.stop();
    expect(written).toEqual(server.token);
  });

  it('answers a request carrying the token', async () => {
    const server = await running();
    const status = await statusOf(server.url, {
      Authorization: `Bearer ${server.token}`,
    });
    await server.stop();
    expect(status).toBe(200);
  });

  it('refuses a request without the token, or with another, as 401', async () => {
    const server = await running();
    const statuses = [
      await statusOf(server.url, {}),
      await statusOf(server.url, { Authorization: 'Bearer not-the-token' }),
    ];
    await server.stop();
    expect(statuses).toEqual([401, 401]);
  });

  it('refuses a foreign Origin or Host as 403, token or not', async () => {
    const server = await running();
    const authorized = { Authorization: `Bearer ${server.token}` };
    const statuses = [
      await statusOf(server.url, {
        ...authorized,
        Origin: 'https://attacker.example',
      }),
      await statusOf(server.url, {
        ...authorized,
        Host: `attacker.example:${server.url.port}`,
      }),
    ];
    await server.stop();
    expect(statuses).toEqual([403, 403]);
  });

  it('refuses a port already taken, exiting 2', async () => {
    const taken = createServer();
    taken.listen(0, '127.0.0.1');
    await once(taken, 'listening');
    const address = taken.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;
    const outcome = await started({ port });
    taken.close();
    expect('code' in outcome && outcome.code).toBe(2);
  });
});
