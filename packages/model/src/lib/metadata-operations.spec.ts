import { Either, Option } from 'effect';
import { parsedFixture } from '../fixtures.js';
import { validModelFixture } from './fixtures.js';
import { setModelMetadata } from './metadata-operations.js';

const base = parsedFixture(validModelFixture);

describe('setModelMetadata', () => {
  it('replaces the named fields and keeps the others', () => {
    const next = Either.getOrThrow(
      setModelMetadata(base, {
        owner: 'Jonas Lindqvist',
        contributors: ['Alexandra de Wit', 'Jonas Lindqvist'],
      }),
    );
    expect(next.metadata).toEqual({
      ...base.metadata,
      owner: 'Jonas Lindqvist',
      contributors: ['Alexandra de Wit', 'Jonas Lindqvist'],
    });
    expect(next.diagrams).toBe(base.diagrams);
  });

  it('clears a field to empty text', () => {
    const next = Either.getOrThrow(
      setModelMetadata(base, { title: '', contributors: [] }),
    );
    expect(next.metadata).toMatchObject({ title: '', contributors: [] });
  });

  it('keeps the model where nothing differs', () => {
    expect(Either.getOrThrow(setModelMetadata(base, {}))).toBe(base);
    expect(
      Either.getOrThrow(setModelMetadata(base, { ...base.metadata })),
    ).toBe(base);
  });

  it('names the field or contributor carrying a refused character', () => {
    expect(
      Option.getOrUndefined(
        Either.getLeft(setModelMetadata(base, { description: 'ab\u0007' })),
      ),
    ).toMatchObject({
      _tag: 'RefusedMetadataCharacter',
      field: 'description',
      at: 2,
    });
    expect(
      Option.getOrUndefined(
        Either.getLeft(
          setModelMetadata(base, { contributors: ['Ada', '\u200bBob'] }),
        ),
      ),
    ).toMatchObject({
      _tag: 'RefusedContributorCharacter',
      contributor: 1,
      at: 0,
    });
  });
});
