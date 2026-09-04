import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  brokenDocumentYaml,
  danglingReferenceYaml,
  fixtureFile,
  unclaimedYaml,
  undeclaredKeyYaml,
} from './cli.fixtures.js';
import { validate } from './validate.js';

const repositoryRoot = join(import.meta.dirname, '../../..');

const directory = mkdtempSync(join(tmpdir(), 'panoptes-cli-validate-'));

const validated = (name: string, text: string) =>
  validate(fixtureFile(directory, name, text));

describe('validate', () => {
  it('reads a Threat Dragon file and counts what the model holds', () => {
    expect(validate(join(repositoryRoot, 'test-data/ecluse.json'))).toEqual({
      code: 0,
      out: 'threat-dragon: 1 diagram, 38 elements, 29 threats\n',
      err: '',
    });
  });

  it('reads the same model in the native format', () => {
    expect(
      validate(join(repositoryRoot, 'test-data/panoptes/ecluse.yaml')),
    ).toEqual({
      code: 0,
      out: 'panoptes-yaml: 1 diagram, 38 elements, 29 threats\n',
      err: '',
    });
  });

  it("reads Panoptes' own threat model, which holds two diagrams", () => {
    expect(
      validate(join(repositoryRoot, 'threat-modelling/panoptes.yaml')),
    ).toEqual({
      code: 0,
      out: 'panoptes-yaml: 2 diagrams, 37 elements, 25 threats\n',
      err: '',
    });
  });

  it('warns about what a read dropped, and still succeeds', () => {
    expect(validated('undeclared.yaml', undeclaredKeyYaml)).toEqual({
      code: 0,
      out: 'panoptes-yaml: 0 diagrams, 0 elements, 1 threat\n',
      err:
        'warning: the file and the model do not correspond exactly.\n' +
        'model: the key nonsense (not declared by the wire schema)\n',
    });
  });

  it('refuses a document the wire schema does not describe', () => {
    expect(validated('broken.yaml', brokenDocumentYaml)).toEqual({
      code: 1,
      out: '',
      err:
        'The file is not a valid document of the format that claimed it:\n' +
        'metadata.title: Invalid input: expected string, received number\n',
    });
  });

  it('points into the model where a reference resolves to nothing', () => {
    expect(validated('dangling.yaml', danglingReferenceYaml)).toEqual({
      code: 1,
      out: '',
      err:
        'The file is a valid document, and the model it maps to is not:\n' +
        'threats.0.elements.0: Threat elements references unknown element id "element-2".\n',
    });
  });

  it('names the bound a text was past', () => {
    expect(
      validate(join(repositoryRoot, 'test-data/adversarial/deep-nesting.json')),
    ).toEqual({
      code: 1,
      out: '',
      err:
        'The file is past a read bound, so nothing read it.\n' +
        'maxNestingDepth: the bound is 64, the file reached 65.\n',
    });
  });

  it('lists the formats tried where none claimed the text', () => {
    expect(validated('unclaimed.yaml', unclaimedYaml)).toMatchObject({
      code: 1,
      out: '',
    });
  });

  it('reports a file it cannot read as the invocation being wrong', () => {
    const path = join(repositoryRoot, 'test-data/absent.json');
    expect(validate(path)).toEqual({
      code: 2,
      out: '',
      err: `error: cannot read ${path}: ENOENT: no such file or directory, open '${path}'\n`,
    });
  });
});
