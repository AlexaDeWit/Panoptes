import { join } from 'node:path';
import { runCli, writeOutcome } from './cli.js';
import { render } from './render.js';
import { validate } from './validate.js';
import { cliVersion } from './version.js';

const repositoryRoot = join(import.meta.dirname, '../../..');

const ecluse = join(repositoryRoot, 'test-data/ecluse.json');

describe('the arguments as the outcome they ask for', () => {
  it('answers --version with the stamped version', () => {
    expect(runCli(['--version'])).toEqual({
      code: 0,
      out: `${cliVersion}\n`,
      err: '',
    });
  });

  it('answers --help on standard output, having been asked', () => {
    const outcome = runCli(['--help']);
    expect(outcome.code).toEqual(0);
    expect(outcome.out).toContain('Usage: panoptes [options] [command]');
    expect(outcome.err).toEqual('');
  });

  it('answers no arguments with the usage text on standard error', () => {
    const outcome = runCli([]);
    expect(outcome.code).toEqual(2);
    expect(outcome.out).toEqual('');
    expect(outcome.err).toContain('Usage: panoptes [options] [command]');
  });

  it('refuses a flag it does not know', () => {
    expect(runCli(['validate', ecluse, '--nope'])).toEqual({
      code: 2,
      out: '',
      err: "error: unknown option '--nope'\n",
    });
  });

  it('refuses a command it does not know', () => {
    expect(runCli(['nope'])).toEqual({
      code: 2,
      out: '',
      err: "error: unknown command 'nope'\n",
    });
  });

  it('refuses a command missing the file it takes', () => {
    expect(runCli(['validate'])).toEqual({
      code: 2,
      out: '',
      err: "error: missing required argument 'file'\n",
    });
  });

  it('hands validate the file it was given', () => {
    expect(runCli(['validate', ecluse])).toEqual(validate(ecluse));
  });

  it('hands render the options it was given', () => {
    expect(runCli(['render', ecluse, '--format', 'md', '--out', '-'])).toEqual(
      render(ecluse, { format: 'md', out: '-' }),
    );
  });

  it('says which options a render needs where it was given none', () => {
    expect(runCli(['render', ecluse])).toEqual({
      code: 2,
      out: '',
      err:
        'error: --format: must be svg or md\n' +
        'error: --out: must be a path, or - for standard output\n',
    });
  });

  it('says which formats there are where the one given is neither', () => {
    expect(runCli(['render', ecluse, '--format', 'pdf', '--out', '-'])).toEqual(
      { code: 2, out: '', err: 'error: --format: must be svg or md\n' },
    );
  });
});

describe('an outcome onto the streams', () => {
  it('writes each text as it is and gives back the code', () => {
    const written = { out: '', err: '' };
    const code = writeOutcome(
      { code: 1, out: 'stdout', err: 'stderr' },
      {
        out: (text) => {
          written.out += text;
        },
        err: (text) => {
          written.err += text;
        },
      },
    );
    expect(code).toEqual(1);
    expect(written).toEqual({ out: 'stdout', err: 'stderr' });
  });
});
