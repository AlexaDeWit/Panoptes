import { themedCanvasStylesheet } from '@panoptes/canvas';
import { render } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DesignTokens } from './theme.js';

const repositoryRoot = join(import.meta.dirname, '../../..');

const trees = [
  join(repositoryRoot, 'apps/studio/src'),
  join(repositoryRoot, 'packages/canvas/src'),
];

const tokenModule = join(repositoryRoot, 'packages/canvas/src/lib/tokens.ts');

const styled = /\.(css|tsx?)$/u;

const beside = /\.(spec|test)\./u;

const filesUnder = (from: string): string[] =>
  readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
    const path = join(from, entry.name);
    return entry.isDirectory()
      ? filesUnder(path)
      : styled.test(entry.name) && !beside.test(entry.name)
        ? [path]
        : [];
  });

const sources = trees
  .flatMap(filesUnder)
  .filter((path) => path !== tokenModule)
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

const referenced = (text: string): string[] =>
  (text.match(/var\(--pn-[\w-]+/gu) ?? []).map((token) => token.slice(4));

const readProperties = new Set([
  ...sources.flatMap((source) => referenced(source.text)),
  ...referenced(themedCanvasStylesheet),
]);

describe('the studio and the canvas, coloured from one table', () => {
  it('carries no literal colour outside the token module', () => {
    const carrying = sources.filter((source) =>
      literalColour.test(source.text),
    );
    expect(carrying.map((source) => source.path)).toEqual([]);
  });

  it('reads the production files of both trees and no spec beside them, which is what this task declares as its inputs', () => {
    const walked = sources.map((source) => source.path);
    expect(walked).toContain('apps/studio/src/styles.css');
    expect(walked).toContain('packages/canvas/src/lib/stylesheet.ts');
    expect(walked.filter((path) => beside.test(path))).toEqual([]);
  });
});

const darkScheme = '@media (prefers-color-scheme: dark)';

const colourDeclarations = (block: string): Set<string> =>
  new Set(block.match(/--pn-colour-[\w-]+(?=:)/gu) ?? []);

describe('DesignTokens', () => {
  it('declares every custom property the studio reads, the injected canvas sheet among them', () => {
    const declared = stylesheet();
    const missing = [...readProperties].filter(
      (property) => !declared.includes(`${property}:`),
    );
    expect(missing).toEqual([]);
  });

  it('declares them on the document root, so any module reads them', () => {
    expect(stylesheet().startsWith(':root {')).toBe(true);
  });

  it('overrides them under the system dark preference, which is the whole of the mode switch', () => {
    expect(stylesheet()).toContain(darkScheme);

    const [root, dark] = stylesheet().split(darkScheme);
    expect(colourDeclarations(dark)).toEqual(colourDeclarations(root));
  });
});
