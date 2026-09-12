import { resourceProseOf } from './fixtures.js';

describe('what a spec reads out of a resource', () => {
  it('names a blob that is no image in unread rather than passing over it', () => {
    expect(
      resourceProseOf({
        contents: [
          { uri: 'saer://a', mimeType: 'text/markdown', blob: 'IyBh' },
          { uri: 'saer://b', mimeType: 'image/png', blob: 'iVBO' },
          { uri: 'saer://c', mimeType: 'text/plain', text: 'read' },
        ],
      }),
    ).toEqual({
      prose: ['read'],
      links: [],
      unread: ['blob text/markdown'],
    });
  });
});
