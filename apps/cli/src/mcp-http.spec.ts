import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import {
  createServer,
  request,
  type IncomingHttpHeaders,
  type OutgoingHttpHeaders,
} from 'node:http';
import { EventEmitter, once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mcpOptionsSchema, serveMcp } from './mcp.js';
import type { CommandOutcome } from './outcome.js';

const repositoryRoot = join(import.meta.dirname, '../../..');

type Running = {
  readonly url: URL;
  readonly token: string;
  readonly reported: string;
  readonly tokenFile: string;
  readonly stop: () => Promise<CommandOutcome>;
};

type Flags = { readonly port?: string; readonly tokenFile?: string };

const freshTokenFile = (): string =>
  join(mkdtempSync(join(tmpdir(), 'saerskriven-cli-token-')), 'token');

const started = async (
  flags: Flags = {},
): Promise<Running | CommandOutcome> => {
  const tokenFile = flags.tokenFile ?? freshTokenFile();
  const events = new EventEmitter();
  const announcement = once(events, 'reported').then(() => undefined);
  let reported = '';
  const outcome = serveMcp(
    mcpOptionsSchema.parse({
      root: repositoryRoot,
      http: true,
      port: flags.port,
      tokenFile,
    }),
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
    token: readFileSync(tokenFile, 'utf8'),
    reported,
    tokenFile,
    stop: () => {
      events.emit('stop');
      return outcome;
    },
  };
};

const running = async (flags: Flags = {}): Promise<Running> => {
  const server = await started(flags);
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

type Answer = {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
};

const answerTo = (url: URL, headers: OutgoingHttpHeaders): Promise<Answer> =>
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
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
        });
      },
    );
    sent.once('error', reject);
    sent.end(discover);
  });

const statusOf = async (
  url: URL,
  headers: OutgoingHttpHeaders,
): Promise<number> => (await answerTo(url, headers)).status;

describe('saer mcp --http', () => {
  it('listens on 127.0.0.1 and ends with the host, exiting 0', async () => {
    const server = await running();
    expect(server.url.hostname).toEqual('127.0.0.1');
    expect(server.url.pathname).toEqual('/mcp');
    expect(await server.stop()).toEqual({ code: 0, out: '', err: '' });
  });

  it('writes the token to its file alone, never reporting it', async () => {
    const server = await running();
    const mode = statSync(server.tokenFile).mode & 0o777;
    await server.stop();
    expect(server.token.length).toBeGreaterThan(0);
    expect(server.reported).not.toContain(server.token);
    expect(server.reported).toContain(server.tokenFile);
    expect(mode).toBe(0o600);
  });

  it('replaces a readable token file with one only its owner reads', async () => {
    const tokenFile = freshTokenFile();
    writeFileSync(tokenFile, 'an earlier token', { mode: 0o644 });
    const server = await running({ tokenFile });
    const mode = statSync(tokenFile).mode & 0o777;
    await server.stop();
    expect(server.token).not.toEqual('an earlier token');
    expect(mode).toBe(0o600);
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
    const answers = [
      await answerTo(server.url, {}),
      await answerTo(server.url, { Authorization: 'Bearer not-the-token' }),
      await answerTo(server.url, {
        Authorization: `Bearer ${server.token} and more`,
      }),
    ];
    await server.stop();
    expect(
      answers.map((answer) => ({
        status: answer.status,
        challenged: answer.headers['www-authenticate'] !== undefined,
      })),
    ).toEqual(answers.map(() => ({ status: 401, challenged: true })));
  });

  it('refuses a foreign Origin or Host as 403, token or not', async () => {
    const server = await running();
    const authorized = { Authorization: `Bearer ${server.token}` };
    const statuses = [
      await statusOf(server.url, {
        ...authorized,
        Origin: 'https://attacker.example',
      }),
      await statusOf(server.url, { ...authorized, Origin: 'null' }),
      await statusOf(server.url, {
        ...authorized,
        Host: `attacker.example:${server.url.port}`,
      }),
    ];
    await server.stop();
    expect(statuses).toEqual([403, 403, 403]);
  });

  it('refuses a port already taken, exiting 2', async () => {
    const taken = createServer();
    taken.listen(0, '127.0.0.1');
    await once(taken, 'listening');
    const address = taken.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;
    const outcome = await started({ port: String(port) });
    taken.close();
    expect('code' in outcome && outcome.code).toBe(2);
  });
});
