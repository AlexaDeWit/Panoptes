import { deepestProse, renderTypst } from '@panoptes/render';
import { Either } from 'effect';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureFile, proseThreatYaml } from './cli.fixtures.js';
import { readModel } from './input.js';
import { compilePdf } from './pdf.js';
import { compileTimeout, outlineTitles, pageCount } from './pdf.fixtures.js';

const repositoryRoot = join(import.meta.dirname, '../../..');

const assets = join(repositoryRoot, 'apps/cli/dist/assets');

const hostileFile = join(
  repositoryRoot,
  'test-data/adversarial/typst-injection.yaml',
);

const directory = mkdtempSync(join(tmpdir(), 'panoptes-cli-pdf-'));

const deepProseFile = fixtureFile(
  directory,
  'deep-prose.yaml',
  proseThreatYaml(`${'> '.repeat(deepestProse - 2)}bottom`),
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
  it(
    'writes a PDF the header of which says so',
    async () => {
      const pdf = Either.getOrThrow(await compiled(document('#"a document"')));
      expect(Buffer.from(pdf.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
    },
    compileTimeout,
  );

  it(
    'gives the same bytes twice for one source, carrying no date',
    async () => {
      const source = document('#"twice"');
      const first = Either.getOrThrow(await compiled(source));
      const second = Either.getOrThrow(await compiled(source));
      expect(Buffer.from(second)).toEqual(Buffer.from(first));
    },
    compileTimeout,
  );

  it(
    'reports what the compiler refused, rather than throwing it',
    async () => {
      expect(refusal(await compiled('#no-such-function()'))).toBe(
        'cannot compile the PDF: unknown variable: no-such-function; if you meant to use subtraction, try adding spaces around the minus signs: `no - such - function`',
      );
    },
    compileTimeout,
  );

  it(
    "joins the compiler's hints into the sentence it reports",
    async () => {
      const deep = `${'#quote(block: true)['.repeat(20)}x${']'.repeat(20)}`;
      expect(refusal(await compiled(document(deep)))).toBe(
        'cannot compile the PDF: maximum show rule depth exceeded; maybe a show rule matches its own output; maybe there are too deeply nested elements',
      );
    },
    compileTimeout,
  );

  it(
    'gives back a quote the compiler escaped, as the quote it stands for',
    async () => {
      expect(refusal(await compiled('#panic("a quoted word")'))).toBe(
        'cannot compile the PDF: panicked with: "a quoted word"',
      );
    },
    compileTimeout,
  );

  it(
    'reports assets it cannot read as a reason to show a user',
    async () => {
      const outcome = await compilePdf(
        document('#"a document"'),
        join(repositoryRoot, 'apps/cli/dist/absent'),
      );
      expect(refusal(outcome)).toContain('typst_ts_web_compiler_bg.wasm');
    },
    compileTimeout,
  );

  it(
    'compiles the deepest prose the register admits',
    async () => {
      const source = renderTypst(
        Either.getOrThrow(readModel(deepProseFile)).model,
      ).typst;
      expect(source.split('#quote(block: true)[').length - 1).toBe(
        deepestProse - 2,
      );
      expect(pageCount(Either.getOrThrow(await compiled(source)))).toBe(1);
    },
    compileTimeout,
  );
});

describe('the hostile fixture', () => {
  it(
    'compiles to a PDF of the pages its two threats need',
    async () => {
      const pdf = Either.getOrThrow(await compiled(hostileSource));
      expect(pageCount(pdf)).toBe(2);
    },
    compileTimeout,
  );

  it(
    'carries every injection attempt into the PDF as text',
    async () => {
      const pdf = Either.getOrThrow(await compiled(hostileSource));
      expect(outlineTitles(pdf)).toEqual([
        'Diagram #read("/etc/passwd") <script>alert(1)</script>',
        'Injection model #eval("1+1") threat register',
        'Threat 1: Title #eval("1+1") <script>alert(1)</script>',
        'Threat 2: Raw HTML in prose',
        '<img src=x onerror="alert(3)">',
        'Injection model #eval("1+1")',
      ]);
    },
    compileTimeout,
  );
});
