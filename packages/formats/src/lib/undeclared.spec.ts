import { z } from 'zod';
import { undeclaredDivergences } from './undeclared.js';

const schema = z.object({ kept: z.object({ inner: z.string() }) });

const reportOn = (given: unknown): readonly string[] =>
  undeclaredDivergences(given, schema.parse(given)).map(
    (divergence) => divergence.detail,
  );

describe('undeclaredDivergences', () => {
  it('reports nothing where the schema declared every key', () => {
    expect(reportOn({ kept: { inner: 'yes' } })).toEqual([]);
  });

  it('names where in the document a stripped key sat', () => {
    expect(reportOn({ kept: { inner: 'yes', b: 1 } })).toEqual([
      'the key kept.b',
    ]);
  });

  it('escapes a dot in a key, so it cannot read as a path through two', () => {
    expect(reportOn({ kept: { inner: 'yes' }, 'a.b': 1 })).toEqual([
      'the key a\\.b',
    ]);
  });

  it('escapes a backslash in a key, so no key renders as another', () => {
    expect(reportOn({ kept: { inner: 'yes' }, 'a\\.b': 1 })).toEqual([
      'the key a\\\\\\.b',
    ]);
  });
});
