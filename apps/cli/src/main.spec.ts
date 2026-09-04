import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  danglingReferenceYaml,
  fixtureFile,
  undeclaredKeyYaml,
} from './fixtures.js';
import { cliVersion } from './version.js';

type Runner = {
  readonly name: string;
  readonly command: string;
  readonly leading: readonly string[];
};

type Scenario = {
  readonly name: string;
  readonly args: readonly string[];
  readonly code: number;
  readonly out: string;
  readonly err: string;
};

const repositoryRoot = join(import.meta.dirname, '../../..');

const directory = mkdtempSync(join(tmpdir(), 'panoptes-cli-main-'));

const bundlePath = join(repositoryRoot, 'apps/cli/dist/main.js');

const bundle: Runner = {
  name: 'the bundle under node',
  command: process.execPath,
  leading: [bundlePath],
};

const hostTarget = (): string | undefined => {
  const probe = spawnSync('deno', ['eval', 'console.log(Deno.build.target)'], {
    encoding: 'utf8',
  });
  return probe.status === 0 ? probe.stdout.trim() : undefined;
};

const compiledRunner = (): Runner | undefined => {
  const target = hostTarget();
  const path = join(
    repositoryRoot,
    'dist/cli',
    `panoptes-${cliVersion}-${String(target)}`,
  );
  return target !== undefined && existsSync(path)
    ? { name: 'the compiled executable', command: path, leading: [] }
    : undefined;
};

const executable = compiledRunner();

const runners: readonly Runner[] =
  executable === undefined ? [bundle] : [bundle, executable];

const ran = (runner: Runner, args: readonly string[]) => {
  const result = spawnSync(runner.command, [...runner.leading, ...args], {
    cwd: repositoryRoot,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { code: result.status, out: result.stdout, err: result.stderr };
};

const text = (runner: Runner, args: readonly string[]) => {
  const result = ran(runner, args);
  return {
    code: result.code,
    out: result.out.toString('utf8'),
    err: result.err.toString('utf8'),
  };
};

const golden = (name: string): Buffer =>
  readFileSync(join(repositoryRoot, 'test-data/render', name));

const danglingFile = fixtureFile(
  directory,
  'dangling.yaml',
  danglingReferenceYaml,
);

const undeclaredFile = fixtureFile(
  directory,
  'undeclared.yaml',
  undeclaredKeyYaml,
);

const scenarios: readonly Scenario[] = [
  {
    name: 'validates a Threat Dragon file',
    args: ['validate', 'test-data/ecluse.json'],
    code: 0,
    out: 'threat-dragon: 1 diagram, 38 elements, 29 threats\n',
    err: '',
  },
  {
    name: 'validates the same model in the native format',
    args: ['validate', 'test-data/panoptes/ecluse.yaml'],
    code: 0,
    out: 'panoptes-yaml: 1 diagram, 38 elements, 29 threats\n',
    err: '',
  },
  {
    name: "validates Panoptes' own threat model",
    args: ['validate', 'threat-modelling/panoptes.yaml'],
    code: 0,
    out: 'panoptes-yaml: 2 diagrams, 37 elements, 25 threats\n',
    err: '',
  },
  {
    name: 'warns about what a read dropped, and still succeeds',
    args: ['validate', undeclaredFile],
    code: 0,
    out: 'panoptes-yaml: 0 diagrams, 0 elements, 1 threat\n',
    err:
      'warning: the file and the model do not correspond exactly.\n' +
      'model: the key nonsense (not declared by the wire schema)\n',
  },
  {
    name: 'refuses a text past a read bound, naming the bound',
    args: ['validate', 'test-data/adversarial/deep-nesting.json'],
    code: 1,
    out: '',
    err:
      'The file is past a read bound, so nothing read it.\n' +
      'maxNestingDepth: the bound is 64, the file reached 65.\n',
  },
  {
    name: 'points into the model where a reference resolves to nothing',
    args: ['validate', danglingFile],
    code: 1,
    out: '',
    err:
      'The file is a valid document, and the model it maps to is not:\n' +
      'threats.0.elements.0: Threat elements references unknown element id "element-2".\n',
  },
  {
    name: 'reports a file that is not there',
    args: ['validate', 'test-data/absent.json'],
    code: 2,
    out: '',
    err: "error: cannot read test-data/absent.json: ENOENT: no such file or directory, open 'test-data/absent.json'\n",
  },
  {
    name: 'refuses a flag it does not know',
    args: ['validate', 'test-data/ecluse.json', '--nope'],
    code: 2,
    out: '',
    err: "error: unknown option '--nope'\n",
  },
  {
    name: 'reports the version the workspace carries',
    args: ['--version'],
    code: 0,
    out: `${cliVersion}\n`,
    err: '',
  },
];

describe('the CLI as it is packaged', () => {
  it('has a bundle to run, which the build target produced', () => {
    expect(existsSync(bundlePath)).toBe(true);
  });
});

describe.each(runners)('the CLI, run as $name', (runner) => {
  it.each(scenarios)('$name', (scenario) => {
    expect(text(runner, scenario.args)).toEqual({
      code: scenario.code,
      out: scenario.out,
      err: scenario.err,
    });
  });

  it('answers no arguments with the usage text and no output', () => {
    const result = text(runner, []);
    expect(result.code).toEqual(2);
    expect(result.out).toEqual('');
    expect(result.err).toContain('Usage: panoptes [options] [command]');
  });

  it('writes the register of the Écluse fixture as the golden file', () => {
    const out = join(directory, `${runner.name}.register.md`);
    expect(
      text(runner, [
        'render',
        'test-data/ecluse.json',
        '--format',
        'md',
        '--out',
        out,
      ]),
    ).toEqual({ code: 0, out: '', err: '' });
    expect(readFileSync(out)).toEqual(golden('ecluse.register.md'));
  });

  it('draws the Écluse fixture as the golden file', () => {
    const out = join(directory, `${runner.name}.svg`);
    expect(
      text(runner, [
        'render',
        'test-data/ecluse.json',
        '--format',
        'svg',
        '--out',
        out,
      ]),
    ).toEqual({ code: 0, out: '', err: '' });
    expect(readFileSync(out)).toEqual(golden('ecluse.svg'));
  });

  it('draws to standard output for an out of -', () => {
    const result = ran(runner, [
      'render',
      'test-data/ecluse.json',
      '--format',
      'svg',
      '--out',
      '-',
    ]);
    expect(result.code).toEqual(0);
    expect(result.out).toEqual(golden('ecluse.svg'));
    expect(result.err.toString('utf8')).toEqual('');
  });

  it('lists the diagrams where a model of several names none', () => {
    expect(
      text(runner, [
        'render',
        'threat-modelling/panoptes.yaml',
        '--format',
        'svg',
        '--out',
        '-',
      ]),
    ).toEqual({
      code: 2,
      out: '',
      err:
        'error: --diagram chooses which diagram to draw, and the model holds several:\n' +
        '  read-and-render: Reading a file and rendering it\n' +
        '  agent-and-desktop: Agents and the desktop shell\n',
    });
  });

  it('draws each diagram a model of several names', () => {
    const chosen = [
      ['read-and-render', 'panoptes-read-and-render.svg'],
      ['Agents and the desktop shell', 'panoptes-agent-and-desktop.svg'],
    ];
    for (const [name, file] of chosen) {
      const result = ran(runner, [
        'render',
        'threat-modelling/panoptes.yaml',
        '--format',
        'svg',
        '--out',
        '-',
        '--diagram',
        name,
      ]);
      expect(result.code).toEqual(0);
      expect(result.out).toEqual(golden(file));
    }
  });
});
