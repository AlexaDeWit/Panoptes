import { renderTypst } from '@panoptes/render';
import { Either } from 'effect';
import { join } from 'node:path';
import { readModel } from './input.js';
import { compilePdf } from './pdf.js';
import { outlineTitles, pageCount } from './pdf.fixtures.js';

const repositoryRoot = join(import.meta.dirname, '../../..');

const assets = join(repositoryRoot, 'apps/cli/dist/assets');

const hostileFile = join(
  repositoryRoot,
  'test-data/adversarial/typst-injection.yaml',
);

const hostileSource = renderTypst(
  Either.getOrThrow(readModel(hostileFile)).model,
).typst;

const document = (body: string): string =>
  ['#set page(paper: "a4")', '#set text(font: "Liberation Sans")', body].join(
    '\n',
  );

const compiled = (source: string) => compilePdf(source, assets);

const refusal = (outcome: Either.Either<Uint8Array, string>): string =>
  Either.match(outcome, {
    onLeft: (reason) => reason,
    onRight: () => 'the compile succeeded',
  });

describe('Typst source compiled to a PDF', () => {
  it('writes a PDF the header of which says so', async () => {
    const pdf = Either.getOrThrow(await compiled(document('#"a document"')));
    expect(Buffer.from(pdf.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
  });

  it('gives the same bytes twice for one source, carrying no date', async () => {
    const source = document('#"twice"');
    const first = Either.getOrThrow(await compiled(source));
    const second = Either.getOrThrow(await compiled(source));
    expect(Buffer.from(second)).toEqual(Buffer.from(first));
  });

  it('reports what the compiler refused, rather than throwing it', async () => {
    expect(refusal(await compiled('#no-such-function()'))).toContain(
      'cannot compile the PDF',
    );
  });

  it('reports assets it cannot read as a reason to show a user', async () => {
    const outcome = await compilePdf(
      document('#"a document"'),
      join(repositoryRoot, 'apps/cli/dist/absent'),
    );
    expect(refusal(outcome)).toContain('cannot compile the PDF');
  });
});

describe('the hostile fixture', () => {
  it('compiles to a PDF of the pages its two threats need', async () => {
    const pdf = Either.getOrThrow(await compiled(hostileSource));
    expect(pageCount(pdf)).toBe(2);
  });

  it('carries every injection attempt into the PDF as text', async () => {
    const pdf = Either.getOrThrow(await compiled(hostileSource));
    expect(outlineTitles(pdf)).toEqual([
      'Diagram #read("/etc/passwd") <script>alert(1)</script>',
      'Injection model #eval("1+1") threat register',
      'Threat 1: Title #eval("1+1") <script>alert(1)</script>',
      'Threat 2: Raw HTML in prose',
      'Injection model #eval("1+1")',
    ]);
  });
});
