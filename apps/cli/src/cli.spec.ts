import { Either } from 'effect';
import { join } from 'node:path';
import { runCli, writeOutcome, type CliStreams } from './cli.js';
import { render, renderOptionsSchema } from './render.js';
import { validate } from './validate.js';
import { cliVersion } from './version.js';

const repositoryRoot = join(import.meta.dirname, '../../..');

const ecluse = join(repositoryRoot, 'test-data/ecluse.json');

const collecting = (failing?: 'out' | 'err') => {
  const written = { out: '', err: '' };
  const to = (stream: 'out' | 'err') => (output: string | Uint8Array) => {
    written[stream] += String(output);
    return stream === failing
      ? Either.left('No space left on device')
      : Either.right(undefined);
  };
  const streams: CliStreams = { out: to('out'), err: to('err') };
  return { written, streams };
};

describe('the arguments as the outcome they ask for', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers --version with the stamped version', async () => {
    await expect(runCli(['--version'])).resolves.toEqual({
      code: 0,
      out: `${cliVersion}\n`,
      err: '',
    });
  });

  it('answers --help on standard output, having been asked', async () => {
    const outcome = await runCli(['--help']);
    expect(outcome.code).toEqual(0);
    expect(outcome.out).toContain('Usage: saer [options] [command]');
    expect(outcome.err).toEqual('');
  });

  it('answers no arguments with the usage text on standard error', async () => {
    const outcome = await runCli([]);
    expect(outcome.code).toEqual(2);
    expect(outcome.out).toEqual('');
    expect(outcome.err).toContain('Usage: saer [options] [command]');
  });

  it('refuses a flag it does not know', async () => {
    await expect(runCli(['validate', ecluse, '--nope'])).resolves.toEqual({
      code: 2,
      out: '',
      err: "error: unknown option '--nope'\n",
    });
  });

  it('refuses a command it does not know', async () => {
    await expect(runCli(['nope'])).resolves.toEqual({
      code: 2,
      out: '',
      err: "error: unknown command 'nope'\n",
    });
  });

  it('refuses a command missing the file it takes', async () => {
    await expect(runCli(['validate'])).resolves.toEqual({
      code: 2,
      out: '',
      err: "error: missing required argument 'file'\n",
    });
  });

  it('hands validate the file it was given', async () => {
    await expect(runCli(['validate', ecluse])).resolves.toEqual(
      validate(ecluse),
    );
  });

  it('hands render the options it was given', async () => {
    await expect(
      runCli(['render', ecluse, '--format', 'md', '--out', '-']),
    ).resolves.toEqual(await render(ecluse, { format: 'md', out: '-' }));
  });

  it('says which options a render needs where it was given none', async () => {
    await expect(runCli(['render', ecluse])).resolves.toEqual({
      code: 2,
      out: '',
      err:
        'error: --format: must be svg, png, md or pdf\n' +
        'error: --out: must be a path, or - for standard output\n',
    });
  });

  it('says which formats there are where the one given is none of them', async () => {
    await expect(
      runCli(['render', ecluse, '--format', 'ps', '--out', '-']),
    ).resolves.toEqual({
      code: 2,
      out: '',
      err: 'error: --format: must be svg, png, md or pdf\n',
    });
  });

  it('hands mcp install the options it was given', async () => {
    const outcome = await runCli([
      'mcp',
      'install',
      '--host',
      'claude-code',
      '--print',
    ]);
    expect(outcome.code).toEqual(0);
    expect(outcome.out).toContain('host: claude-code\n');
    expect(outcome.out).toContain('status: shown\n');
  });

  it("refuses an install naming both of a host's files", async () => {
    await expect(
      runCli(['mcp', 'install', '--host', 'cursor', '--project', '--user']),
    ).resolves.toEqual({
      code: 2,
      out: '',
      err: 'error: --project: names the file a project commits and --user the one that covers every project, so pass one of them\n',
    });
  });

  it('reports a command that threw rather than letting it escape', async () => {
    vi.spyOn(process, 'cwd').mockImplementation(() => {
      throw new Error('the working directory is gone');
    });
    await expect(
      runCli(['mcp', 'install', '--host', 'claude-code', '--print']),
    ).resolves.toEqual({
      code: 2,
      out: '',
      err: 'error: the working directory is gone\n',
    });
  });

  it('says why a command threw where the parser wrote nothing', async () => {
    vi.spyOn(renderOptionsSchema, 'safeParse').mockImplementation(() => {
      throw new Error('the option schema gave out');
    });
    await expect(
      runCli(['render', ecluse, '--format', 'md', '--out', '-']),
    ).resolves.toEqual({
      code: 2,
      out: '',
      err: 'error: the option schema gave out\n',
    });
  });
});

describe('an outcome onto the streams', () => {
  it('writes each text as it is and gives back the code', () => {
    const streams = collecting();
    const code = writeOutcome(
      { code: 1, out: 'stdout', err: 'stderr' },
      streams.streams,
    );
    expect(code).toEqual(1);
    expect(streams.written).toEqual({ out: 'stdout', err: 'stderr' });
  });

  it('reports a standard output that would not take the text, and exits 2', () => {
    const streams = collecting('out');
    const code = writeOutcome(
      { code: 0, out: 'the document', err: '' },
      streams.streams,
    );
    expect(code).toEqual(2);
    expect(streams.written.err).toEqual(
      'error: cannot write to standard output: No space left on device\n',
    );
  });

  it('exits 2 without a word where standard error is the stream that failed', () => {
    const streams = collecting('err');
    const code = writeOutcome(
      { code: 0, out: '', err: 'a warning' },
      streams.streams,
    );
    expect(code).toEqual(2);
  });
});

describe('a command that rejects rather than answering', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('./render.js');
    vi.resetModules();
  });

  it('reports the rejection rather than letting it reach the process', async () => {
    vi.doMock('./render.js', async () => ({
      ...(await vi.importActual<typeof import('./render.js')>('./render.js')),
      render: () => Promise.reject(new Error('the projection gave out')),
    }));
    const rejecting = await import('./cli.js');
    await expect(
      rejecting.runCli(['render', ecluse, '--format', 'md', '--out', '-']),
    ).resolves.toEqual({
      code: 2,
      out: '',
      err: 'error: the projection gave out\n',
    });
  });
});
