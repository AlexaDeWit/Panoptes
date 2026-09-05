import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  danglingReferenceYaml,
  fixtureFile,
  noDiagramYaml,
  unplacedFlowYaml,
} from './cli.fixtures.js';
import { compileTimeout, pageCount } from './pdf.fixtures.js';
import { render, type RenderOptions } from './render.js';

const repositoryRoot = join(import.meta.dirname, '../../..');

const directory = mkdtempSync(join(tmpdir(), 'panoptes-cli-render-'));

const ecluse = join(repositoryRoot, 'test-data/ecluse.json');

const ecluseYaml = join(repositoryRoot, 'test-data/panoptes/ecluse.yaml');

const panoptes = join(repositoryRoot, 'threat-modelling/panoptes.yaml');

const golden = (name: string): string =>
  readFileSync(join(repositoryRoot, 'test-data/render', name), 'utf8');

const options = (given: Partial<RenderOptions>): RenderOptions => ({
  format: 'svg',
  out: '-',
  ...given,
});

const assets = join(repositoryRoot, 'apps/cli/dist/assets');

const bytesOf = (out: string | Uint8Array): Uint8Array =>
  typeof out === 'string' ? Buffer.from(out, 'utf8') : out;

const written = async (
  name: string,
  file: string,
  given: Partial<RenderOptions>,
) => {
  const out = join(directory, name);
  return {
    outcome: await render(file, options({ ...given, out }), assets),
    bytes: () => readFileSync(out),
    text: () => readFileSync(out, 'utf8'),
  };
};

describe('render', () => {
  it('writes the register of the Écluse fixture as the golden file', async () => {
    const run = await written('ecluse.register.md', ecluse, { format: 'md' });
    expect(run.outcome).toEqual({ code: 0, out: '', err: '' });
    expect(run.text()).toEqual(golden('ecluse.register.snapshot.md'));
  });

  it('draws the Écluse fixture as the golden file', async () => {
    const run = await written('ecluse.svg', ecluse, { format: 'svg' });
    expect(run.outcome).toEqual({ code: 0, out: '', err: '' });
    expect(run.text()).toEqual(golden('ecluse.snapshot.svg'));
  });

  it('writes the register to standard output for an out of -', async () => {
    await expect(
      render(ecluse, options({ format: 'md', out: '-' })),
    ).resolves.toEqual({
      code: 0,
      out: golden('ecluse.register.snapshot.md'),
      err: '',
    });
  });

  it('draws to standard output for an out of -', async () => {
    await expect(
      render(ecluse, options({ format: 'svg', out: '-' })),
    ).resolves.toEqual({
      code: 0,
      out: golden('ecluse.snapshot.svg'),
      err: '',
    });
  });

  it('projects the same model out of the native format, byte for byte', async () => {
    await expect(
      render(ecluseYaml, options({ format: 'md', out: '-' })),
    ).resolves.toEqual({
      code: 0,
      out: golden('ecluse.register.snapshot.md'),
      err: '',
    });
    await expect(
      render(ecluseYaml, options({ format: 'svg', out: '-' })),
    ).resolves.toEqual({
      code: 0,
      out: golden('ecluse.snapshot.svg'),
      err: '',
    });
  });

  it('draws the diagram a model of several names by id', async () => {
    await expect(
      render(panoptes, options({ diagram: 'read-and-render' })),
    ).resolves.toEqual({
      code: 0,
      out: golden('panoptes-read-and-render.snapshot.svg'),
      err: '',
    });
  });

  it('draws the diagram a model of several names by title', async () => {
    await expect(
      render(panoptes, options({ diagram: 'Agents and the desktop shell' })),
    ).resolves.toEqual({
      code: 0,
      out: golden('panoptes-agent-and-desktop.snapshot.svg'),
      err: '',
    });
  });

  it('lists the diagrams where a model of several names none', async () => {
    await expect(render(panoptes, options({}))).resolves.toEqual({
      code: 2,
      out: '',
      err:
        'error: --diagram chooses which diagram to draw, and the model holds several:\n' +
        '  read-and-render: Reading a file and rendering it\n' +
        '  agent-and-desktop: Agents and the desktop shell\n',
    });
  });

  it('lists the diagrams where the name given is none of them', async () => {
    await expect(
      render(panoptes, options({ diagram: 'nope' })),
    ).resolves.toEqual({
      code: 2,
      out: '',
      err:
        'error: the model holds no diagram named "nope".\n' +
        '  read-and-render: Reading a file and rendering it\n' +
        '  agent-and-desktop: Agents and the desktop shell\n',
    });
  });

  it('refuses to draw a model that holds no diagram', async () => {
    const file = fixtureFile(directory, 'no-diagram.yaml', noDiagramYaml);
    await expect(render(file, options({}))).resolves.toEqual({
      code: 2,
      out: '',
      err: 'error: the model holds no diagram, so there is nothing to draw.\n',
    });
  });

  it('reports a flow endpoint the layout left out of the drawing', async () => {
    const file = fixtureFile(directory, 'unplaced.yaml', unplacedFlowYaml);
    await expect(render(file, options({ out: '-' }))).resolves.toMatchObject({
      code: 0,
      err:
        'warning: a flow endpoint names an element the canvas draws as no box, so its flow is not in the drawing.\n' +
        '  flow "flow-2" target names "flow-1"\n',
    });
  });

  it('refuses a diagram chosen for a register, which holds them all', async () => {
    await expect(
      render(ecluse, options({ format: 'md', diagram: '0' })),
    ).resolves.toEqual({
      code: 2,
      out: '',
      err: 'error: --diagram chooses one diagram, and --format md writes the whole register.\n',
    });
  });

  it('refuses a diagram chosen for a PDF, which draws them all', async () => {
    await expect(
      render(ecluse, options({ format: 'pdf', diagram: '0' })),
    ).resolves.toEqual({
      code: 2,
      out: '',
      err: 'error: --diagram chooses one diagram, and --format pdf writes every diagram and the register.\n',
    });
  });

  it(
    'compiles the Écluse fixture to a PDF of diagram and register',
    async () => {
      const run = await written('ecluse.pdf', ecluse, { format: 'pdf' });
      expect(run.outcome).toEqual({ code: 0, out: '', err: '' });
      const pdf = run.bytes();
      expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(pageCount(pdf)).toBe(14);
    },
    compileTimeout,
  );

  it(
    'writes a PDF to standard output for an out of -',
    async () => {
      const outcome = await render(
        ecluse,
        options({ format: 'pdf', out: '-' }),
        assets,
      );
      expect(outcome.code).toBe(0);
      expect(outcome.out).toBeInstanceOf(Uint8Array);
      expect(pageCount(bytesOf(outcome.out))).toBe(14);
    },
    compileTimeout,
  );

  it(
    'reports an install missing the files it typesets with, and exits 2',
    async () => {
      const outcome = await render(
        ecluse,
        options({ format: 'pdf', out: '-' }),
        join(repositoryRoot, 'apps/cli/dist/absent'),
      );
      expect(outcome.code).toBe(2);
      expect(outcome.out).toBe('');
      expect(outcome.err).toContain('error: cannot compile the PDF');
    },
    compileTimeout,
  );

  it('reports an out it cannot write as the invocation being wrong', async () => {
    const out = join(directory, 'absent', 'ecluse.svg');
    await expect(render(ecluse, options({ out }))).resolves.toEqual({
      code: 2,
      out: '',
      err: `error: cannot write ${out}: ENOENT: no such file or directory, open '${out}'\n`,
    });
  });

  it('reports a file it read and refused before drawing anything', async () => {
    const file = fixtureFile(directory, 'dangling.yaml', danglingReferenceYaml);
    await expect(render(file, options({}))).resolves.toMatchObject({
      code: 1,
      out: '',
    });
  });
});
