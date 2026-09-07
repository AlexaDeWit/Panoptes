import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { darkPalette, lightPalette } from '@saerskriven/canvas';
import {
  initialColourModeScript,
  initialPageStylesheet,
} from '../../initial-page.mjs';
import { colourModeStorageKey } from '../theme-preference.js';

const source = readFileSync(
  join(import.meta.dirname, '../../index.html'),
  'utf8',
);
const page = new DOMParser().parseFromString(source, 'text/html');
const root = page.querySelector('#root');
const publicDirectory = join(import.meta.dirname, '../../public');

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
    expect(initialColourModeScript).toContain(colourModeStorageKey);
    expect(initialPageStylesheet).toContain(lightPalette.surfaceCanvas);
    expect(initialPageStylesheet).toContain(darkPalette.surfaceCanvas);
    expect(initialPageStylesheet).toContain(
      'background: var(--pn-colour-canvas)',
    );
    expect(initialPageStylesheet).toContain(
      '@media (prefers-reduced-motion: reduce)',
    );
  });

  it('links the selected SVG favicon', () => {
    const favicon = page.querySelector('link[rel="icon"]');
    expect(favicon?.getAttribute('type')).toBe('image/svg+xml');
    expect(favicon?.getAttribute('href')).toBe('/favicon.svg');

    const icon = new DOMParser().parseFromString(
      readFileSync(join(publicDirectory, 'favicon.svg'), 'utf8'),
      'image/svg+xml',
    );
    expect(icon.querySelector('parsererror')).toBeNull();
    expect(icon.documentElement.getAttribute('viewBox')).toBe('0 0 64 64');
    expect(existsSync(join(publicDirectory, 'favicon.ico'))).toBe(false);
  });
});
