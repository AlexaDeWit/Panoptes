import { spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  danglingReferenceYaml,
  fixtureFile,
  undeclaredKeyYaml,
} from './cli.fixtures.js';
import { outlineTitles, pageCount } from './pdf.fixtures.js';
import { cliVersion } from './version.js';

type Runner = {
  readonly name: string;
  readonly command: string;
  readonly leading: readonly string[];
  readonly absence: string | undefined;
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
  absence: undefined,
};

const hostTarget = (): string | undefined => {
  const probe = spawnSync('deno', ['eval', 'console.log(Deno.build.target)'], {
    encoding: 'utf8',
  });
  return probe.status === 0 ? probe.stdout.trim() : undefined;
};

const executablePath = join(
  repositoryRoot,
  'dist/cli',
  `panoptes-${cliVersion}-${hostTarget() ?? 'unknown-host-target'}`,
);

const compiled: Runner = {
  name: 'the compiled executable',
  command: executablePath,
  leading: [],
  absence: existsSync(executablePath)
    ? undefined
    : `nothing is at ${executablePath}, which scripts/package-cli.sh writes`,
};

const runners: readonly Runner[] = [bundle, compiled];

const titleOf = (runner: Runner): string =>
  runner.absence === undefined
    ? `the CLI, run as ${runner.name}`
    : `the CLI, run as ${runner.name}, skipped because ${runner.absence}`;

const fullDevice = '/dev/full';

const compileTimeout = 60_000;

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

  it('has the compiled executable wherever the environment demands one', () => {
    expect(
      process.env.PANOPTES_COMPILED_RUNNER === 'required'
        ? compiled.absence
        : undefined,
    ).toBeUndefined();
  });
});

for (const runner of runners) {
  const register = runner.absence === undefined ? describe : describe.skip;
  register(titleOf(runner), () => {
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
      expect(readFileSync(out)).toEqual(golden('ecluse.register.snapshot.md'));
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
      expect(readFileSync(out)).toEqual(golden('ecluse.snapshot.svg'));
    });

    it(
      'writes the Écluse fixture as a PDF of diagram and register',
      () => {
        const out = join(directory, `${runner.name}.pdf`);
        expect(
          text(runner, [
            'render',
            'test-data/ecluse.json',
            '--format',
            'pdf',
            '--out',
            out,
          ]),
        ).toEqual({ code: 0, out: '', err: '' });
        const pdf = readFileSync(out);
        expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
        expect(pageCount(pdf)).toBe(14);
        expect(outlineTitles(pdf)).toContain('Écluse threat register');
      },
      compileTimeout,
    );

    it(
      'writes a PDF to standard output as bytes, not as text',
      () => {
        const out = join(directory, `${runner.name}.stdout.pdf`);
        const streamed = ran(runner, [
          'render',
          'test-data/ecluse.json',
          '--format',
          'pdf',
          '--out',
          '-',
        ]);
        text(runner, [
          'render',
          'test-data/ecluse.json',
          '--format',
          'pdf',
          '--out',
          out,
        ]);
        expect(streamed.code).toEqual(0);
        expect(streamed.out.subarray(0, 5).toString('latin1')).toBe('%PDF-');
        expect(pageCount(streamed.out)).toBe(14);
        expect(streamed.out).toEqual(readFileSync(out));
      },
      compileTimeout,
    );

    it(
      'carries a hostile fixture into the PDF as text, not as markup',
      () => {
        const out = join(directory, `${runner.name}.hostile.pdf`);
        expect(
          text(runner, [
            'render',
            'test-data/adversarial/typst-injection.yaml',
            '--format',
            'pdf',
            '--out',
            out,
          ]),
        ).toEqual({ code: 0, out: '', err: '' });
        const pdf = readFileSync(out);
        expect(pageCount(pdf)).toBe(2);
        expect(outlineTitles(pdf)).toContain(
          'Threat 1: Title #eval("1+1") <script>alert(1)</script>',
        );
        expect(outlineTitles(pdf)).toContain('<img src=x onerror="alert(3)">');
      },
      compileTimeout,
    );

    it('refuses a diagram chosen for a PDF, which draws them all', () => {
      expect(
        text(runner, [
          'render',
          'test-data/ecluse.json',
          '--format',
          'pdf',
          '--out',
          '-',
          '--diagram',
          '0',
        ]),
      ).toEqual({
        code: 2,
        out: '',
        err: 'error: --diagram chooses one diagram, and --format pdf writes every diagram and the register.\n',
      });
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
      expect(result.out).toEqual(golden('ecluse.snapshot.svg'));
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
        ['read-and-render', 'panoptes-read-and-render.snapshot.svg'],
        [
          'Agents and the desktop shell',
          'panoptes-agent-and-desktop.snapshot.svg',
        ],
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

    it('says one line and exits 2 where standard output will not take it', (ctx) => {
      if (!existsSync(fullDevice)) {
        ctx.skip(`this platform has no ${fullDevice}`);
      }
      const device = openSync(fullDevice, 'w');
      const result = spawnSync(
        runner.command,
        [
          ...runner.leading,
          'render',
          'test-data/ecluse.json',
          '--format',
          'svg',
          '--out',
          '-',
        ],
        { cwd: repositoryRoot, stdio: ['ignore', device, 'pipe'] },
      );
      closeSync(device);
      const reported = result.stderr.toString('utf8');
      expect(result.status).toEqual(2);
      expect(reported).toContain('error: cannot write to standard output: ');
      expect(reported.split('\n')).toHaveLength(2);
    });
  });
}
