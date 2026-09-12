import {
  OAuthError,
  OAuthErrorCode,
  STDIO_DEFAULT_MAX_BUFFER_SIZE,
  bearerAuthChallengeResponse,
  createMcpHandler,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  validateHostHeader,
  validateOriginHeader,
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
import { reasonOf, writeFile } from './files.js';
import {
  lines,
  succeeded,
  usageError,
  type CommandOutcome,
} from './outcome.js';

/** The only address the HTTP server listens on, whatever the flags say. */
export const httpAddress = '127.0.0.1';

/** The one path the HTTP server answers on. */
export const httpPath = '/mcp';

/** Where the HTTP server listens, and where its token is also written. */
export type HttpServing = {
  readonly port: number;
  readonly tokenFile: string | undefined;
};

/** What an HTTP server reports through while it runs, and what ends it. */
export type HttpHost = {
  readonly report: (text: string) => void;
  readonly stopped: () => Promise<void>;
};

/**
 * Serve the factory's server over Streamable HTTP until the host stops it.
 * The address, then the token, are reported once the port is bound and the
 * token file is written, so a reader of either can connect.
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
  const bound = Either.flatMap(await listening(server, serving.port), (port) =>
    Either.map(tokenWritten(serving.tokenFile, token), () => port),
  );
  if (Either.isLeft(bound)) {
    await closed(server, handler);
    return usageError(lines(`error: ${bound.left}`));
  }
  host.report(announcement(bound.right, token));
  await host.stopped();
  await closed(server, handler);
  return succeeded('', '');
}

/** The lines a started server writes: its address, then its bearer token. */
export function announcement(port: number, token: string): string {
  return lines(
    `MCP server at http://${httpAddress}:${port}${httpPath}`,
    `Bearer token: ${token}`,
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
): Promise<Either.Either<number, string>> {
  return new Promise((resolve) => {
    server.once('error', (error) => {
      resolve(
        Either.left(
          `cannot listen on ${httpAddress}:${port}: ${reasonOf(error)}`,
        ),
      );
    });
    server.listen(port, httpAddress, () => {
      const address = server.address();
      resolve(
        Either.right(
          typeof address === 'object' && address !== null ? address.port : port,
        ),
      );
    });
  });
}

function tokenWritten(
  path: string | undefined,
  token: string,
): Either.Either<void, string> {
  return path === undefined
    ? Either.right(undefined)
    : writeFile(path, token, 0o600);
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
  const refusal = refused(request, token);
  if (refusal !== undefined) {
    await sent(refusal, response);
    return;
  }
  const body = await bodyOf(request);
  await sent(
    Either.isLeft(body)
      ? jsonRpcRefusal(413, body.left)
      : await handler.fetch(webRequest(request, body.right)),
    response,
  );
}

function refused(
  request: IncomingMessage,
  token: string,
): Response | undefined {
  const hostHeader = validateHostHeader(
    request.headers.host,
    localhostAllowedHostnames(),
  );
  const origin = validateOriginHeader(
    request.headers.origin,
    localhostAllowedOrigins(),
  );
  return !hostHeader.ok
    ? jsonRpcRefusal(403, hostHeader.message)
    : !origin.ok
      ? jsonRpcRefusal(403, origin.message)
      : !bearing(request.headers.authorization, token)
        ? bearerAuthChallengeResponse(
            new OAuthError(
              OAuthErrorCode.InvalidToken,
              'The bearer token is missing or is not the one this server printed',
            ),
          )
        : new URL(request.url ?? '/', 'http://localhost').pathname !== httpPath
          ? jsonRpcRefusal(404, `This server answers on ${httpPath} only`)
          : undefined;
}

function bearing(authorization: string | undefined, token: string): boolean {
  const [scheme, presented] = (authorization ?? '').split(' ');
  return (
    scheme?.toLowerCase() === 'bearer' &&
    timingSafeEqual(digest(presented ?? ''), digest(token))
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

async function bodyOf(
  request: IncomingMessage,
): Promise<Either.Either<Buffer, string>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += bytes.length;
    if (size <= STDIO_DEFAULT_MAX_BUFFER_SIZE) {
      chunks.push(bytes);
    }
  }
  return size > STDIO_DEFAULT_MAX_BUFFER_SIZE
    ? Either.left(
        `The request body is past ${STDIO_DEFAULT_MAX_BUFFER_SIZE} bytes`,
      )
    : Either.right(Buffer.concat(chunks));
}

function webRequest(request: IncomingMessage, body: Buffer): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    for (const each of [value ?? []].flat()) {
      headers.append(name, each);
    }
  }
  const method = request.method ?? 'GET';
  return new Request(new URL(request.url ?? '/', `http://${httpAddress}`), {
    method,
    headers,
    body:
      method === 'GET' || method === 'HEAD' ? undefined : new Uint8Array(body),
  });
}

async function sent(reply: Response, response: ServerResponse): Promise<void> {
  response.writeHead(reply.status, [...reply.headers.entries()].flat());
  const reader = reply.body?.getReader();
  response.once('close', () => {
    void reader?.cancel();
  });
  for (
    let read = await reader?.read();
    read !== undefined && !read.done;
    read = await reader?.read()
  ) {
    response.write(read.value);
  }
  response.end();
}
