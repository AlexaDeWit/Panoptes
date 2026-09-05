import {
  parseModel,
  threatSchema,
  type Model,
  type Threat,
} from '@panoptes/model';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderRegister } from './markdown-register.js';
import { deepestProse } from './register-tree.js';
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

const nested = (levels: number): string => `${'> '.repeat(levels)}bottom`;

const quotesIn = (source: string): number =>
  source.split('#quote(block: true)[').length - 1;

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
  it('writes a raw HTML node as the text the author wrote', () => {
    const source = proseOf('Set <span onclick="boom()">the flag</span> first.');
    expect(source).toContain('#"<span onclick=\\"boom()\\">"');
    expect(source).toContain('the flag');
    expect(withoutLiterals(source)).not.toContain('<span');
    expect(withoutLiterals(source)).not.toContain('onclick');
  });

  it('keeps a mitigation an author wrote as HTML alone', () => {
    const model = modelOf([
      threatOf({ number: 1, mitigation: '<img src=x onerror="alert(1)">' }),
    ]);
    expect(sourceOf(model)).toContain('<img src=x onerror=');
    expect(renderRegister(model)).toContain('<img src=x onerror=');
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

  it('writes a link as its own text with the address beside it', () => {
    const source = proseOf('A [link](https://example.invalid/x).');
    expect(source).toContain('#"link"');
    expect(source).toContain('#" (https://example.invalid/x)"');
    expect(withoutLiterals(source)).not.toContain('#link(');
  });

  it('writes an autolink once, not as its own address twice', () => {
    const source = proseOf('See <https://example.invalid/x> for more.');
    expect(source).toContain('#"https://example.invalid/x"');
    expect(source).not.toContain('#" (https://example.invalid/x)"');
  });

  it('keeps the address of a link definition and of an image', () => {
    expect(proseOf('![a picture](https://example.invalid/p.png)')).toContain(
      '#" (https://example.invalid/p.png)"',
    );
    expect(proseOf('[cite]: https://example.invalid/d')).toContain(
      '#"[cite]: https://example.invalid/d"',
    );
  });

  it('writes a quote, a rule, a break and a strikethrough', () => {
    expect(proseOf('> quoted')).toContain('#quote(block: true)[');
    expect(proseOf('a\n\n---\n\nb')).toContain('#line(length: 100%)');
    expect(proseOf('a\\\nb')).toContain('#linebreak()');
    expect(proseOf('~~gone~~')).toContain('#strike[#"gone"]');
  });

  it('writes a table and a heading inside prose', () => {
    const source = proseOf('| a | b |\n| - | - |\n| 1 | 2 |\n\n## Inside');
    expect(source).toContain('#table(columns: 2,');
    expect(source).toContain('#heading(level: 4)[#"Inside"]');
  });

  it('writes a footnote as its reference and its text', () => {
    const source = proseOf('A claim[^1].\n\n[^1]: The evidence.');
    expect(source).toContain('#"[1]"');
    expect(source).toContain('#"The evidence."');
  });

  it('writes a reference-style image as its alternative text', () => {
    const source = proseOf(
      '![a picture][p]\n\n[p]: https://example.invalid/p.png',
    );
    expect(source).toContain('#"a picture"');
  });

  it('writes a reference-style link as its text', () => {
    const source = proseOf(
      'See [the policy][p].\n\n[p]: https://example.invalid/p',
    );
    expect(source).toContain('#"the policy"');
    expect(source).toContain('#"[p]: https://example.invalid/p"');
  });

  it('collapses a soft line break inside a paragraph to a space', () => {
    expect(proseOf('first\nsecond')).toContain('#"first second"');
  });
});

describe('the prose depth bound', () => {
  it('is the depth both writers survive, counted from the root', () => {
    expect(deepestProse).toBe(16);
  });

  it('writes the deepest prose it admits as the nesting the author wrote', () => {
    const admitted = deepestProse - 2;
    const source = proseOf(nested(admitted));
    expect(quotesIn(source)).toBe(admitted);
    expect(
      renderRegister(
        modelOf([threatOf({ number: 1, description: nested(admitted) })]),
      ),
    ).toContain('bottom');
  });

  it("writes prose one level past the bound as the author's own bytes", () => {
    const source = proseOf(nested(deepestProse - 1));
    expect(quotesIn(source)).toBe(0);
    expect(source).toContain('bottom');
  });
});
