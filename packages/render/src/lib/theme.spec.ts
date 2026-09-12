import {
  badgeTextColour,
  contrastRatio,
  defaultRenderTheme,
  severityToneClass,
} from '@saerskriven/canvas';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { typstFontAssets, typstWasmModule } from '../build-assets.js';
import { compilePdf } from '../pdf.js';
import { threatSchema } from '@saerskriven/model';
import { ecluseModel } from '../goldens.fixtures.js';
import { renderRegister } from './markdown-register.js';
import { registerDocument } from './register-tree.js';
import { registerStylesheet } from './register-stylesheet.js';
import { renderSvg } from './svg-document.js';
import { renderTypst } from './typst-document.js';
import { readThemeOverrides, withBundledFonts } from './theme.js';

const sample = {
  ...ecluseModel,
  threats: [
    threatSchema.parse({
      ...ecluseModel.threats[0],
      number: 7,
      severity: 'high',
      status: 'open',
      description: '# First\n\n###### Last',
    }),
    threatSchema.parse({
      ...ecluseModel.threats[0],
      id: 'accepted-example',
      number: 8,
      status: 'accepted-risk',
    }),
  ],
};

describe('consumer themes', () => {
  it('keeps nested defaults while applying valid sibling overrides', () => {
    const read = readThemeOverrides({
      severity: { high: '#b45309', low: 'oops', typo: '#123' },
      fonts: [],
      badges: { style: 'outline', borderWidth: 99 },
      extra: true,
    });
    expect(read.theme).toEqual({
      ...defaultRenderTheme,
      severity: { ...defaultRenderTheme.severity, high: '#b45309' },
      badges: { ...defaultRenderTheme.badges, style: 'outline' },
    });
    expect(new Set(read.diagnostics.map((entry) => entry.key))).toEqual(
      new Set([
        'badges.borderWidth',
        'extra',
        'fonts',
        'severity.low',
        'severity.typo',
      ]),
    );
    expect(readThemeOverrides({}).theme).toEqual(defaultRenderTheme);
    expect(
      readThemeOverrides({ severity: { high: '#abc' } }).theme.severity.high,
    ).toBe('#aabbcc');
  });

  it.each([null, [], 2, 'text'])(
    'falls back for a non-mapping value %s',
    (value) => {
      const read = readThemeOverrides(value);
      expect(read.theme).toEqual(defaultRenderTheme);
      expect(read.diagnostics).toHaveLength(1);
    },
  );

  it('rejects appearance source while retaining ordinary values', () => {
    const read = readThemeOverrides({
      fonts: { body: 'X; color: red', code: 'Liberation Sans' },
      severity: { high: 'url(https://example.test)' },
      badges: { text: '#fff', style: 'custom()' },
    });
    expect(read.theme.fonts).toEqual({
      body: defaultRenderTheme.fonts.body,
      code: 'Liberation Sans',
    });
    expect(read.theme.badges.text).toBe('#ffffff');
    expect(read.diagnostics.map((entry) => entry.key)).toEqual([
      'severity.high',
      'fonts.body',
      'badges.style',
    ]);
  });

  it('uses the same severity override in website badges, drawings, and PDF content', () => {
    const theme = readThemeOverrides({
      severity: { high: '#b45309' },
      status: { 'accepted-risk': '#223344' },
    }).theme;
    const svg = renderSvg(sample.diagrams[0], sample, theme).svg;
    const markdown = renderRegister(sample, { styled: true, theme });
    const typst = renderTypst(sample, theme).typst;
    expect(svg).toContain(`.${severityToneClass.high} { fill: #b45309;`);
    expect(markdown).toContain('--saer-severity-high: #b45309');
    expect(markdown).toContain('saer-severity-high');
    expect(markdown).toContain('saer-status-accepted-risk');
    expect(typst).toContain('#saer-badge("High", rgb("#b45309"))');
    expect(typst).toContain('#saer-badge("Accepted risk", rgb("#223344"))');
    expect(svg).toContain('class="pn-tone-high"');
    const embedded = typst.slice(
      typst.indexOf('#image(bytes('),
      typst.indexOf('format: "svg"'),
    );
    expect(embedded).toContain('.pn-tone-high { fill: #b45309;');
  });

  it('applies font and outlined badge controls without hiding labels', () => {
    const theme = readThemeOverrides({
      fonts: { body: 'Liberation Mono', code: 'Liberation Sans' },
      badges: { style: 'outline', borderWidth: 1, text: '#123456' },
    }).theme;
    const svg = renderSvg(sample.diagrams[0], sample, theme).svg;
    const typst = renderTypst(sample, theme).typst;
    expect(svg).toContain('font-family: "Liberation Mono"');
    expect(svg).toContain(
      `fill: ${theme.colours.background}; stroke: ${theme.severity.high}; stroke-width: 1`,
    );
    expect(svg).toContain('fill: #123456');
    expect(typst).toContain(
      'fill: none, stroke: (paint: tone, thickness: 1pt)',
    );
    expect(typst).toContain('text(fill: rgb("#123456"), label)');
    expect(registerStylesheet(theme)).toContain(
      '--saer-badge-background: transparent',
    );
  });

  it('keeps every default severity and status label above the text contrast floor', () => {
    for (const style of ['filled', 'outline'] as const) {
      const theme = {
        ...defaultRenderTheme,
        badges: { ...defaultRenderTheme.badges, style },
      };
      for (const tone of [
        ...Object.values(theme.severity),
        ...Object.values(theme.status),
      ]) {
        const background = style === 'filled' ? tone : theme.colours.background;
        expect(
          contrastRatio(badgeTextColour(theme, tone), background),
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps appearance out of portable output and permits the host stylesheet', () => {
    const plain = renderRegister(sample);
    const styled = renderRegister(sample, { styled: true, stylesheet: false });
    expect(plain).toContain('High');
    expect(plain).toContain('Accepted risk');
    expect(plain).not.toContain('saer-badge');
    expect(styled).toContain('<span class="saer-badge-label">High</span>');
    expect(styled).not.toContain('<style>');
    expect(styled).not.toContain('style=');
    expect(styled).toContain('<div class="saer-register">');
  });

  it('reports unavailable embedded fonts and preserves supported siblings', () => {
    const fitted = withBundledFonts(
      readThemeOverrides({
        fonts: { body: 'Site Font', code: 'Liberation Sans' },
      }).theme,
    );
    expect(fitted.theme.fonts).toEqual({
      body: 'Liberation Sans',
      code: 'Liberation Sans',
    });
    expect(fitted.diagnostics.map((entry) => entry.key)).toEqual([
      'fonts.body',
    ]);
  });
});

describe.each([false, true])('register embedding, styled %s', (styled) => {
  it('starts threats at H3 below an existing H2 without another title', () => {
    const options = { styled, title: false, headingLevel: 3 as const };
    const markdown = renderRegister(sample, options);
    expect(markdown).toContain('### Threat 7:');
    expect(markdown).not.toMatch(/^# /mu);
    expect(markdown).toContain('#### First');
    expect(markdown).toContain('###### Last');
    expect(markdown).toContain('<a name="threat-7"></a>');
    expect(markdown).toContain('[7](#threat-7)');
  });

  it.each([1, 2, 3, 4, 5, 6] as const)(
    'keeps anchors when the first heading is H%s',
    (headingLevel) => {
      for (const title of [false, true]) {
        const markdown = renderRegister(sample, {
          styled,
          title,
          headingLevel,
        });
        expect(markdown).toContain('<a name="threat-7"></a>');
        expect(markdown).toContain('[7](#threat-7)');
        const headings = registerDocument(sample, {
          title,
          headingLevel,
        }).children.filter((node) => node.type === 'heading');
        expect(headings[0].depth).toBe(headingLevel);
        expect(headings.every((node) => node.depth <= 6)).toBe(true);
      }
    },
  );
});

describe('themed PDF compilation', () => {
  it.each(['filled', 'outline'] as const)(
    'typesets %s badges and embedded drawings',
    async (style) => {
      const fonts = typstFontAssets((message) => {
        throw new Error(message);
      });
      const theme = readThemeOverrides({
        severity: { high: '#b45309' },
        fonts: { body: 'Liberation Mono' },
        badges: { style },
      }).theme;
      const result = await compilePdf(renderTypst(sample, theme).typst, {
        wasm: readFileSync(typstWasmModule),
        fonts: fonts.map((font) => readFileSync(font.from)),
      });
      expect(Either.isRight(result)).toBe(true);
      expect(
        Buffer.from(Either.getOrThrow(result).subarray(0, 5)).toString(),
      ).toBe('%PDF-');
    },
  );
});
