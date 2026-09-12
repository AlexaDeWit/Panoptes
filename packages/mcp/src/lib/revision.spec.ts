import { revisionOf } from './revision.js';

describe('the revision handle of a file', () => {
  it('names the hash it is and spells it as lowercase hex', () => {
    expect(revisionOf(new TextEncoder().encode('formatVersion: 1\n'))).toEqual(
      'sha256:097d3db94d0354a821973730e61c3916a350465b29de30b4ae3906fb4405848b',
    );
  });

  it('answers the same bytes with the same handle', () => {
    const bytes = new TextEncoder().encode('a model');
    expect(revisionOf(bytes)).toEqual(revisionOf(Uint8Array.from(bytes)));
  });

  it('answers one changed byte with another handle', () => {
    expect(revisionOf(new TextEncoder().encode('a model'))).not.toEqual(
      revisionOf(new TextEncoder().encode('a modeL')),
    );
  });
});
