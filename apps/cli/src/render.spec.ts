import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  danglingReferenceYaml,
  fixtureFile,
  noDiagramYaml,
  unplacedFlowYaml,
} from './cli.fixtures.js';
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

const written = (name: string, file: string, given: Partial<RenderOptions>) => {
  const out = join(directory, name);
  return {
    outcome: render(file, options({ ...given, out })),
    text: () => readFileSync(out, 'utf8'),
  };
};

describe('render', () => {
  it('writes the register of the Écluse fixture as the golden file', () => {
    const run = written('ecluse.register.md', ecluse, { format: 'md' });
    expect(run.outcome).toEqual({ code: 0, out: '', err: '' });
    expect(run.text()).toEqual(golden('ecluse.register.snapshot.md'));
  });

  it('draws the Écluse fixture as the golden file', () => {
    const run = written('ecluse.svg', ecluse, { format: 'svg' });
    expect(run.outcome).toEqual({ code: 0, out: '', err: '' });
    expect(run.text()).toEqual(golden('ecluse.snapshot.svg'));
  });

  it('writes the register to standard output for an out of -', () => {
    expect(render(ecluse, options({ format: 'md', out: '-' }))).toEqual({
      code: 0,
      out: golden('ecluse.register.snapshot.md'),
      err: '',
    });
  });

  it('draws to standard output for an out of -', () => {
    expect(render(ecluse, options({ format: 'svg', out: '-' }))).toEqual({
      code: 0,
      out: golden('ecluse.snapshot.svg'),
      err: '',
    });
  });

  it('projects the same model out of the native format, byte for byte', () => {
    expect(render(ecluseYaml, options({ format: 'md', out: '-' }))).toEqual({
      code: 0,
      out: golden('ecluse.register.snapshot.md'),
      err: '',
    });
    expect(render(ecluseYaml, options({ format: 'svg', out: '-' }))).toEqual({
      code: 0,
      out: golden('ecluse.snapshot.svg'),
      err: '',
    });
  });

  it('draws the diagram a model of several names by id', () => {
    expect(render(panoptes, options({ diagram: 'read-and-render' }))).toEqual({
      code: 0,
      out: golden('panoptes-read-and-render.snapshot.svg'),
      err: '',
    });
  });

  it('draws the diagram a model of several names by title', () => {
    expect(
      render(panoptes, options({ diagram: 'Agents and the desktop shell' })),
    ).toEqual({
      code: 0,
      out: golden('panoptes-agent-and-desktop.snapshot.svg'),
      err: '',
    });
  });

  it('lists the diagrams where a model of several names none', () => {
    expect(render(panoptes, options({}))).toEqual({
      code: 2,
      out: '',
      err:
        'error: --diagram chooses which diagram to draw, and the model holds several:\n' +
        '  read-and-render: Reading a file and rendering it\n' +
        '  agent-and-desktop: Agents and the desktop shell\n',
    });
  });

  it('lists the diagrams where the name given is none of them', () => {
    expect(render(panoptes, options({ diagram: 'nope' }))).toEqual({
      code: 2,
      out: '',
      err:
        'error: the model holds no diagram named "nope".\n' +
        '  read-and-render: Reading a file and rendering it\n' +
        '  agent-and-desktop: Agents and the desktop shell\n',
    });
  });

  it('refuses to draw a model that holds no diagram', () => {
    const file = fixtureFile(directory, 'no-diagram.yaml', noDiagramYaml);
    expect(render(file, options({}))).toEqual({
      code: 2,
      out: '',
      err: 'error: the model holds no diagram, so there is nothing to draw.\n',
    });
  });

  it('reports a flow endpoint the layout left out of the drawing', () => {
    const file = fixtureFile(directory, 'unplaced.yaml', unplacedFlowYaml);
    expect(render(file, options({ out: '-' }))).toMatchObject({
      code: 0,
      err:
        'warning: a flow endpoint names an element the canvas draws as no box, so its flow is not in the drawing.\n' +
        '  flow "flow-2" target names "flow-1"\n',
    });
  });

  it('refuses a diagram chosen for a register, which holds them all', () => {
    expect(render(ecluse, options({ format: 'md', diagram: '0' }))).toEqual({
      code: 2,
      out: '',
      err: 'error: --diagram chooses one diagram, and --format md writes the whole register.\n',
    });
  });

  it('reports an out it cannot write as the invocation being wrong', () => {
    const out = join(directory, 'absent', 'ecluse.svg');
    expect(render(ecluse, options({ out }))).toEqual({
      code: 2,
      out: '',
      err: `error: cannot write ${out}: ENOENT: no such file or directory, open '${out}'\n`,
    });
  });

  it('reports a file it read and refused before drawing anything', () => {
    const file = fixtureFile(directory, 'dangling.yaml', danglingReferenceYaml);
    expect(render(file, options({}))).toMatchObject({ code: 1, out: '' });
  });
});
