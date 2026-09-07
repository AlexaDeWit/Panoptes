import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { darkPalette, lightPalette } from '@saerskriven/canvas';
import { initialPageStylesheet } from '../../initial-page.mjs';

const source = readFileSync(
  join(import.meta.dirname, '../../index.html'),
  'utf8',
);
const page = new DOMParser().parseFromString(source, 'text/html');
const root = page.querySelector('#root');

describe('the initial page', () => {
  it('keeps search metadata without exposing temporary page copy', () => {
    expect(page.title.trim()).not.toBe('');
    expect(
      page
        .querySelector('meta[name="description"]')
        ?.getAttribute('content')
        ?.trim(),
    ).toBeTruthy();
    expect(page.querySelectorAll('#root [role="status"]')).toHaveLength(1);
    expect(
      page.querySelector('#root [role="status"]')?.textContent?.trim(),
    ).toBeTruthy();
    expect(
      page.querySelector('#root noscript')?.textContent?.trim(),
    ).toBeTruthy();
    expect(page.querySelector('#root h1')).toBeNull();
    expect(
      [...page.body.children].filter((element) => element.tagName !== 'SCRIPT'),
    ).toEqual([root]);
  });

  it('starts on the canvas colour for either system scheme', () => {
    expect(initialPageStylesheet).toContain(lightPalette.surfaceCanvas);
    expect(initialPageStylesheet).toContain(darkPalette.surfaceCanvas);
    expect(initialPageStylesheet).toContain(
      'background: var(--pn-colour-canvas)',
    );
    expect(initialPageStylesheet).toContain(
      '@media (prefers-reduced-motion: reduce)',
    );
  });
});
