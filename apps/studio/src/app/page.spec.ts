import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(import.meta.dirname, '../../index.html'),
  'utf8',
);
const page = new DOMParser().parseFromString(source, 'text/html');

describe('the initial page', () => {
  it('describes the studio before JavaScript runs', () => {
    expect(page.title.trim()).not.toBe('');
    expect(
      page
        .querySelector('meta[name="description"]')
        ?.getAttribute('content')
        ?.trim(),
    ).toBeTruthy();
    expect(page.querySelector('#root h1')?.textContent?.trim()).toBeTruthy();
    expect(page.querySelector('#root p')?.textContent?.trim()).toBeTruthy();
    expect(page.querySelector('section')?.textContent?.trim()).toBeTruthy();
    expect(page.querySelector('section a[href]')).not.toBeNull();
  });
});
