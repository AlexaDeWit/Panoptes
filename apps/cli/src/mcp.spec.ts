import { typstFontFiles } from '@saerskriven/render/build-assets';
import { drawingFace } from '@saerskriven/render/png';
import { Either } from 'effect';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import {
  mcpOptionsSchema,
  processHost,
  rasterizerIn,
  serveMcp,
} from './mcp.js';
import { resvgWasmFile } from './png.js';

const repositoryRoot = join(import.meta.dirname, '../../..');

const served = (root: string) => {
  const input = new PassThrough();
  const output = new PassThrough();
  const outcome = serveMcp(mcpOptionsSchema.parse({ root }), {
    ...processHost(),
    input,
    output,
  });
  return { input, output, outcome };
};

describe('what the mcp subcommand is given', () => {
  it('reads the working directory as the root where none is named', () => {
    expect(mcpOptionsSchema.parse({})).toEqual({
      root: process.cwd(),
      file: undefined,
      http: undefined,
    });
  });

  it('refuses a port or a token file without --http', () => {
    expect(mcpOptionsSchema.safeParse({ port: '8080' }).success).toBe(false);
    expect(mcpOptionsSchema.safeParse({ tokenFile: 'token' }).success).toBe(
      false,
    );
  });

  it('refuses --http without a token file', () => {
    expect(mcpOptionsSchema.safeParse({ http: true }).success).toBe(false);
    expect(
      mcpOptionsSchema.parse({ http: true, port: '8080', tokenFile: 'token' })
        .http,
    ).toEqual({ port: 8080, tokenFile: 'token' });
  });
});

const assetsIn = (directory: string): string => {
  writeFileSync(join(directory, resvgWasmFile), 'module');
  for (const name of typstFontFiles) {
    writeFileSync(join(directory, name), `face:${name}`);
  }
  return directory;
};

const disposable = (): string =>
  assetsIn(mkdtempSync(join(tmpdir(), 'saerskriven-cli-mcp-')));

describe('the rasterizer one server reads', () => {
  it('answers every render from bytes read once, the directory gone', () => {
    const directory = disposable();
    const rasterizer = rasterizerIn(directory);
    const first = rasterizer();
    rmSync(directory, { recursive: true, force: true });
    expect(Either.isRight(first)).toBe(true);
    expect(rasterizer()).toEqual(first);
  });

  it('leads with the face the drawings are lettered in', () => {
    const rasterizer = rasterizerIn(disposable());
    expect(
      Either.map(rasterizer(), (assets) =>
        Buffer.from(assets.fonts[0] ?? []).toString('utf8'),
      ),
    ).toEqual(Either.right(`face:${drawingFace}`));
  });

  it('re-reads a directory it could not read rather than holding the refusal', () => {
    const directory = mkdtempSync(join(tmpdir(), 'saerskriven-cli-mcp-bare-'));
    const rasterizer = rasterizerIn(directory);
    expect(Either.isLeft(rasterizer())).toBe(true);
    assetsIn(directory);
    expect(Either.isRight(rasterizer())).toBe(true);
  });
});

describe('the mcp subcommand as it runs', () => {
  it('refuses a root that is not there, saying so on standard error', async () => {
    const missing = join(repositoryRoot, 'nowhere-at-all');
    const outcome = await serveMcp(mcpOptionsSchema.parse({ root: missing }));
    expect(outcome.code).toEqual(2);
    expect(outcome.out).toEqual('');
    expect(outcome.err).toContain(`The root "${missing}" cannot be used`);
  });

  it('ends when the host closes the input, writing nothing anywhere', async () => {
    const session = served(repositoryRoot);
    session.input.end();
    expect(await session.outcome).toEqual({ code: 0, out: '', err: '' });
    expect(session.output.read()).toBeNull();
  });
});
