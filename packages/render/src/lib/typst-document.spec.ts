import {
  parseModel,
  threatSchema,
  type Model,
  type Threat,
} from '@panoptes/model';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderTypst } from './typst-document.js';

const repositoryRoot = join(import.meta.dirname, '../../../..');

const goldenPath = join(repositoryRoot, 'test-data/render/ecluse.snapshot.typ');

const committedModel = (name: string): Model =>
  Either.getOrThrow(
    parseModel(JSON.parse(readFileSync(join(repositoryRoot, name), 'utf8'))),
  );

const ecluseModel = committedModel('test-data/ecluse.model.json');

const panoptesModel = committedModel('test-data/panoptes.model.json');

const threatOf = (fields: {
  readonly number: number;
  readonly title?: string;
  readonly description?: string;
  readonly mitigation?: string;
}): Threat =>
  threatSchema.parse({
    id: `threat-${String(fields.number)}`,
    title: `Threat ${String(fields.number)}`,
    category: { methodology: 'STRIDE', category: 'tampering' },
    severity: 'medium',
    status: 'open',
    description: '',
    mitigation: '',
    elements: [],
    ...fields,
  });

const modelOf = (threats: readonly Threat[], title = 'Sample'): Model => ({
  metadata: { title, owner: '', description: '', contributors: [] },
  diagrams: [],
  threats: [...threats],
  lastIssuedThreatNumber: Math.max(
    0,
    ...threats.map((threat) => threat.number),
  ),
  mitigations: [],
  assumptions: [],
});

const sourceOf = (model: Model): string => renderTypst(model).typst;

const proseOf = (written: string): string =>
  sourceOf(modelOf([threatOf({ number: 1, description: written })]));

/**
 * The source with every Typst string literal replaced by an empty one. What
 * is left is the document's own template, so a hostile fragment surviving
 * here reached the source as Typst code rather than as text.
 */
const withoutLiterals = (source: string): string =>
  source.replace(/"(?:[^"\\]|\\[\s\S])*"/gu, '""');

describe('the Typst document', () => {
  it('matches the golden file committed under test-data', async () => {
    await expect(sourceOf(ecluseModel)).toMatchFileSnapshot(goldenPath);
  });

  it('draws every diagram of the model, ahead of the register', () => {
    const source = sourceOf(panoptesModel);
    const images = source.split('#image(bytes(').length - 1;
    expect(images).toBe(panoptesModel.diagrams.length);
    expect(source.indexOf('#image(bytes(')).toBeLessThan(
      source.indexOf('threat register'),
    );
  });

  it('reports a flow endpoint no diagram could draw', () => {
    expect(renderTypst(ecluseModel).unplaced).toEqual([]);
  });

  it('writes the same source twice for the same model', () => {
    expect(sourceOf(ecluseModel)).toBe(sourceOf(ecluseModel));
  });
});

describe('a value out of the model', () => {
  it('reaches the source inside a string literal and nowhere else', () => {
    const source = proseOf(
      '#eval("1+1") #include "/etc/passwd" #read("/etc/passwd")',
    );
    expect(source).toContain('#eval(\\"1+1\\")');
    expect(withoutLiterals(source)).not.toContain('#eval');
    expect(withoutLiterals(source)).not.toContain('#read');
    expect(withoutLiterals(source)).not.toContain('#include');
  });

  it('cannot close the literal it is written in', () => {
    const source = proseOf('a" + read("/etc/passwd") + "b');
    expect(source).toContain('a\\" + read(\\"/etc/passwd\\") + \\"b');
    expect(withoutLiterals(source)).not.toContain('read');
  });

  it('cannot escape the literal with a trailing backslash', () => {
    expect(proseOf('trailing \\')).toContain('"trailing \\\\"');
  });

  it('carries markup characters through as text', () => {
    const source = proseOf('stars \\*not bold\\* and \\_not italic\\_');
    expect(source).toContain('stars *not bold* and _not italic_');
    expect(withoutLiterals(source)).not.toContain('*');
    expect(withoutLiterals(source)).not.toContain('_');
  });

  it('writes a control character as a Typst escape', () => {
    const title = `bell${String.fromCodePoint(7)}end`;
    expect(sourceOf(modelOf([], title))).toContain('bell\\u{7}end');
  });
});

describe('threat prose', () => {
  it('drops a raw HTML node rather than writing it out', () => {
    const source = proseOf('Set <span onclick="boom()">the flag</span> first.');
    expect(source).toContain('Set ');
    expect(source).toContain('the flag');
    expect(source).not.toContain('<span');
    expect(source).not.toContain('onclick');
  });

  it('writes a list as a Typst list', () => {
    expect(proseOf('- one\n- two')).toContain('#list([#"one"], [#"two"])');
  });

  it('writes a numbered list as a Typst enumeration', () => {
    expect(proseOf('3. one\n4. two')).toContain(
      '#enum(start: 3, [#"one"], [#"two"])',
    );
  });

  it('writes emphasis, strong and code through Typst functions', () => {
    const source = proseOf('*a* **b** `c`');
    expect(source).toContain('#emph[#"a"]');
    expect(source).toContain('#strong[#"b"]');
    expect(source).toContain('#raw("c")');
  });

  it('keeps the lines of a fenced code block', () => {
    expect(proseOf('```\nfirst\nsecond\n```')).toContain(
      '#raw(block: true, "first\nsecond")',
    );
  });

  it('writes a link as its own text, with nothing to follow', () => {
    const source = proseOf('A [link](https://example.invalid).');
    expect(source).toContain('#"link"');
    expect(source).not.toContain('example.invalid');
  });

  it('collapses a soft line break inside a paragraph to a space', () => {
    expect(proseOf('first\nsecond')).toContain('#"first second"');
  });
});
