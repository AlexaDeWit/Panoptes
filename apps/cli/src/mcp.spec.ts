import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { mcpOptionsSchema, serveMcp } from './mcp.js';

const repositoryRoot = join(import.meta.dirname, '../../..');

const served = (root: string) => {
  const input = new PassThrough();
  const output = new PassThrough();
  const outcome = serveMcp({ root }, { input, output });
  return { input, output, outcome };
};

describe('what the mcp subcommand is given', () => {
  it('reads the working directory as the root where none is named', () => {
    expect(mcpOptionsSchema.parse({})).toEqual({
      root: process.cwd(),
      file: undefined,
    });
  });
});

describe('the mcp subcommand as it runs', () => {
  it('refuses a root that is not there, saying so on standard error', async () => {
    const missing = join(repositoryRoot, 'nowhere-at-all');
    const outcome = await serveMcp({ root: missing });
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
