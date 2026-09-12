import {
  OAuthError,
  OAuthErrorCode,
  STDIO_DEFAULT_MAX_BUFFER_SIZE,
  bearerAuthChallengeResponse,
  createMcpHandler,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  originValidationResponse,
  type McpHttpHandler,
  type McpServerFactory,
} from '@modelcontextprotocol/server';
import { Either } from 'effect';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { pipeline } from 'node:stream/promises';
import { createPrivateFile, reasonOf } from './files.js';
import {
  lines,
  succeeded,
  usageError,
  type CommandOutcome,
} from './outcome.js';

const httpAddress = '127.0.0.1';

const httpPath = '/mcp';

type HttpServing = {
  readonly port: number;
  readonly tokenFile: string;
};

/** What an HTTP server reports through while it runs, and what ends it. */
export type HttpHost = {
  readonly report: (text: string) => void;
  readonly stopped: () => Promise<void>;
};

/**
 * Serve the factory's server over Streamable HTTP until the host stops it.
 * The token is minted per start and written to the token file alone. The
 * address and the file's path are reported once both are in place.
 */
export async function serveHttp(
  factory: McpServerFactory,
  serving: HttpServing,
  host: HttpHost,
): Promise<CommandOutcome> {
  const token = randomBytes(32).toString('base64url');
  const handler = createMcpHandler(factory, {
    onerror: (error) => {
      host.report(lines(`error: ${error.message}`));
    },
  });
  const server = createServer((request, response) => {
    void answer(handler, token, request, response).catch((error: unknown) => {
      host.report(lines(`error: ${reasonOf(error)}`));
    });
  });
  const bound = Either.flatMap(
    await listening(server, serving.port),
    (address) =>
      Either.map(createPrivateFile(serving.tokenFile, token), () => address),
  );
  if (Either.isLeft(bound)) {
    await closed(server, handler);
    return usageError(lines(`error: ${bound.left}`));
  }
  const stopped = host.stopped();
  host.report(announcement(bound.right, serving.tokenFile));
  await stopped;
  await closed(server, handler);
  return succeeded('', '');
}

function announcement(bound: AddressInfo, tokenFile: string): string {
  return lines(
    `MCP server at http://${bound.address}:${bound.port}${httpPath}`,
    `Bearer token written to ${tokenFile}`,
  );
}

/** The first SIGINT or SIGTERM the process receives. */
export function processStopped(): Promise<void> {
  return new Promise((resolve) => {
    const settle = (): void => {
      process.off('SIGINT', settle);
      process.off('SIGTERM', settle);
      resolve();
    };
    process.once('SIGINT', settle);
    process.once('SIGTERM', settle);
  });
}

function listening(
  server: Server,
  port: number,
): Promise<Either.Either<AddressInfo, string>> {
  const refusal = (reason: string): string =>
    `cannot listen on ${httpAddress}:${port}: ${reason}`;
  return new Promise((resolve) => {
    server.once('error', (error) => {
      resolve(Either.left(refusal(reasonOf(error))));
    });
    server.listen(port, httpAddress, () => {
      const address = server.address();
      resolve(
        typeof address === 'object' && address !== null
          ? Either.right(address)
          : Either.left(refusal('the socket reports no address')),
      );
    });
  });
}

async function closed(server: Server, handler: McpHttpHandler): Promise<void> {
  await handler.close();
  server.closeAllConnections();
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

async function answer(
  handler: McpHttpHandler,
  token: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const headers = headersOf(request);
  const refusal = refused(request, headers, token);
  if (refusal !== undefined) {
    await sent(refusal, response);
    return;
  }
  const body = await bodyOf(request);
  if (Either.isLeft(body)) {
    body.left.headers.set('Connection', 'close');
    await sent(body.left, response);
    return;
  }
  await sent(
    await handler.fetch(webRequest(request, headers, body.right)),
    response,
  );
}

function refused(
  request: IncomingMessage,
  headers: Headers,
  token: string,
): Response | undefined {
  const head = webRequest(request, headers, undefined);
  return (
    hostHeaderValidationResponse(head, localhostAllowedHostnames()) ??
    originValidationResponse(head, localhostAllowedOrigins()) ??
    (!bearing(request.headers.authorization, token)
      ? bearerAuthChallengeResponse(
          new OAuthError(
            OAuthErrorCode.InvalidToken,
            'The bearer token is missing or is not the one in the token file',
          ),
        )
      : new URL(request.url ?? '/', 'http://localhost').pathname !== httpPath
        ? jsonRpcRefusal(404, `This server answers on ${httpPath} only`)
        : undefined)
  );
}

function bearing(authorization: string | undefined, token: string): boolean {
  const presented = /^Bearer (\S+)$/i.exec(authorization ?? '')?.[1];
  return (
    presented !== undefined && timingSafeEqual(digest(presented), digest(token))
  );
}

function digest(text: string): Buffer {
  return createHash('sha256').update(text).digest();
}

function jsonRpcRefusal(status: number, message: string): Response {
  return Response.json(
    { jsonrpc: '2.0', error: { code: -32000, message }, id: null },
    { status },
  );
}

function bodyOf(
  request: IncomingMessage,
): Promise<Either.Either<Buffer, Response>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const take = (chunk: Buffer): void => {
      size += chunk.length;
      if (size <= STDIO_DEFAULT_MAX_BUFFER_SIZE) {
        chunks.push(chunk);
        return;
      }
      request.off('data', take);
      request.pause();
      resolve(
        Either.left(
          jsonRpcRefusal(
            413,
            `The request body is past ${STDIO_DEFAULT_MAX_BUFFER_SIZE} bytes`,
          ),
        ),
      );
    };
    request.on('data', take);
    request.once('end', () => {
      resolve(Either.right(Buffer.concat(chunks)));
    });
    request.once('error', (error) => {
      resolve(Either.left(jsonRpcRefusal(400, reasonOf(error))));
    });
  });
}

function headersOf(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    for (const each of [value ?? []].flat()) {
      headers.append(name, each);
    }
  }
  return headers;
}

function webRequest(
  request: IncomingMessage,
  headers: Headers,
  body: Buffer | undefined,
): Request {
  const method = request.method ?? 'GET';
  return new Request(new URL(request.url ?? '/', `http://${httpAddress}`), {
    method,
    headers,
    body:
      body === undefined || method === 'GET' || method === 'HEAD'
        ? undefined
        : new Uint8Array(body),
  });
}

async function sent(reply: Response, response: ServerResponse): Promise<void> {
  if (response.destroyed) {
    await reply.body?.cancel().catch(() => undefined);
    return;
  }
  response.writeHead(reply.status, [...reply.headers.entries()].flat());
  if (reply.body === null) {
    response.end();
    return;
  }
  const reader = reply.body.getReader();
  response.once('close', () => {
    reader.cancel().catch(() => undefined);
  });
  await pipeline(chunksOf(reader), response);
}

async function* chunksOf(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    yield read.value;
  }
}
