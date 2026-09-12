import { defaultRenderTheme } from '@saerskriven/render';
import { readLimits } from '@saerskriven/formats';
import { Either } from 'effect';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureFile } from './cli.fixtures.js';
import { runCli } from './cli.js';
import { commandTheme, readThemeFile, themeWarnings } from './theme.js';

const directory = mkdtempSync(join(tmpdir(), 'saerskriven-theme-'));
const model = join(
  import.meta.dirname,
  '../../../test-data/saerskriven/ecluse.yaml',
);
afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

function file(text: string): string {
  return fixtureFile(directory, 'theme.yaml', text);
}

describe('best-effort theme files', () => {
  it.each(['', '  \n', '# Consumer colours\n'])(
    'uses defaults for empty content %j',
    (text) => {
      const read = Either.getOrThrow(readThemeFile(file(text)));
      expect(read).toEqual({ theme: defaultRenderTheme, diagnostics: [] });
    },
  );

  it.each(['[', '- item', 'null', '42'])(
    'continues with defaults for unusable content %s',
    async (text) => {
      const path = file(text);
      const outcome = await runCli([
        'render',
        model,
        '--format',
        'md',
        '--out',
        '-',
        '--styled',
        '--theme',
        path,
      ]);
      expect(outcome.code).toBe(0);
      expect(outcome.out).toContain('saer-register');
      expect(outcome.err).toContain(path);
      expect(outcome.err).toContain('defaults');
    },
  );

  it('continues after an unreadable file and keeps warnings off stdout', async () => {
    const missing = join(directory, 'absent.yaml');
    const outcome = await runCli([
      'render',
      model,
      '--format',
      'svg',
      '--out',
      '-',
      '--theme',
      missing,
    ]);
    expect(outcome.code).toBe(0);
    expect(outcome.out).toMatch(/^<svg /u);
    expect(outcome.out).not.toContain('warning:');
    expect(outcome.err).toContain(missing);
  });

  it('applies valid sibling values and identifies ignored paths', async () => {
    const path = file(
      "severity:\n  high: '#b45309'\n  low: false\n  hihg: '#123456'\nfonts: 2\nbadges:\n  style: outline\n",
    );
    const outcome = await runCli([
      'render',
      model,
      '--format',
      'md',
      '--out',
      '-',
      '--styled',
      '--no-title',
      '--heading-level',
      '3',
      '--theme',
      path,
    ]);
    expect(outcome.code).toBe(0);
    expect(outcome.out).toContain('--saer-severity-high: #b45309');
    expect(outcome.out).toContain('--saer-badge-background: transparent');
    expect(outcome.out).toMatch(/^### Threat /mu);
    expect(outcome.out).not.toMatch(/^# /mu);
    expect(outcome.err).toContain('severity.low');
    expect(outcome.err).toContain('severity.hihg');
    expect(outcome.err).toContain('fonts');
  });

  it('retains parser size, depth and alias limits', () => {
    const entries = [
      ' '.repeat(readLimits.maxTextBytes + 1),
      '['.repeat(readLimits.maxNestingDepth + 1) +
        ']'.repeat(readLimits.maxNestingDepth + 1),
      `a: &a []\nb: [${Array.from({ length: readLimits.maxAliasCount + 1 }, () => '*a').join(',')}]`,
    ];
    for (const text of entries) {
      const read = commandTheme(file(text), 'svg', false);
      expect(read.theme).toEqual(defaultRenderTheme);
      expect(read.diagnostics).not.toHaveLength(0);
    }
  });

  it('reports unsupported output settings without failing', async () => {
    const path = file(
      "fonts:\n  body: Site Font\nseverity:\n  high: '#123456'\n",
    );
    const fitted = commandTheme(path, 'pdf', false);
    expect(fitted.theme.fonts.body).toBe('Liberation Sans');
    expect(fitted.theme.severity.high).toBe('#123456');
    expect(fitted.diagnostics[0].key).toBe('fonts.body');
    const portable = await runCli([
      'render',
      model,
      '--format',
      'md',
      '--out',
      '-',
      '--theme',
      path,
    ]);
    expect(portable.code).toBe(0);
    expect(portable.out).not.toContain('saer-badge');
    expect(portable.err).toContain('portable Markdown');
    const hosted = await runCli([
      'render',
      model,
      '--format',
      'md',
      '--out',
      '-',
      '--styled',
      '--no-stylesheet',
      '--theme',
      path,
    ]);
    expect(hosted.out).not.toContain('<style>');
    expect(hosted.err).toContain('host CSS');
  });

  it('escapes terminal controls in diagnostic keys and paths', () => {
    expect(
      themeWarnings('bad\u001b[31m', [
        { key: 'key\u001b[31m', message: 'ignored\u001b[31m' },
      ]),
    ).not.toContain('\u001b');
  });

  it.each(['0', '7', '3.5', 'other'])(
    'refuses an invalid heading level %s',
    async (level) => {
      expect(
        (
          await runCli([
            'render',
            model,
            '--format',
            'md',
            '--out',
            '-',
            '--heading-level',
            level,
          ])
        ).code,
      ).toBe(2);
    },
  );
});
