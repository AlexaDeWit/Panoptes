import { render } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DesignTokens } from './theme.js';

const repositoryRoot = join(import.meta.dirname, '../../..');

const trees = [
  join(repositoryRoot, 'apps/studio/src'),
  join(repositoryRoot, 'packages/canvas/src'),
];

const tokenModule = [
  join(repositoryRoot, 'packages/canvas/src/lib/tokens.ts'),
  join(repositoryRoot, 'packages/canvas/src/lib/tokens.spec.ts'),
];

const styled = /\.(css|tsx?)$/u;

const filesUnder = (from: string): string[] =>
  readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
    const path = join(from, entry.name);
    return entry.isDirectory()
      ? filesUnder(path)
      : styled.test(entry.name)
        ? [path]
        : [];
  });

const sources = trees
  .flatMap(filesUnder)
  .filter((path) => !tokenModule.includes(path))
  .map((path) => ({
    path: relative(repositoryRoot, path),
    text: readFileSync(path, 'utf8'),
  }));

const literalColour =
  /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/u;

const stylesheet = (): string => {
  const { container } = render(<DesignTokens />);
  return container.querySelector('style')?.textContent ?? '';
};

const readProperties = new Set(
  sources.flatMap((source) =>
    (source.text.match(/var\(--pn-[\w-]+/gu) ?? []).map((token) =>
      token.slice(4),
    ),
  ),
);

describe('the studio and the canvas, coloured from one table', () => {
  it('carries no literal colour outside the token module', () => {
    const carrying = sources.filter((source) =>
      literalColour.test(source.text),
    );
    expect(carrying.map((source) => source.path)).toEqual([]);
  });

  it('walked both trees, the global stylesheet and the canvas sheet among them', () => {
    const walked = sources.map((source) => source.path);
    expect(walked).toContain('apps/studio/src/styles.css');
    expect(walked).toContain('packages/canvas/src/lib/stylesheet.ts');
  });
});

describe('DesignTokens', () => {
  it('declares every custom property the studio reads', () => {
    const declared = stylesheet();
    const missing = [...readProperties].filter(
      (property) => !declared.includes(`${property}:`),
    );
    expect(missing).toEqual([]);
  });

  it('declares them on the document root, so any module reads them', () => {
    expect(stylesheet().startsWith(':root {')).toBe(true);
  });
});
