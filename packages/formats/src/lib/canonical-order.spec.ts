import { z } from 'zod';
import { canonicalOrder } from './canonical-order.js';

const tagged = z.discriminatedUnion('kind', [
  z.object({ id: z.string(), kind: z.literal('leaf') }),
  z.object({ id: z.string(), kind: z.literal('branch'), of: z.string() }),
]);

const untaggedOption = {
  def: {
    type: 'union',
    discriminator: 'kind',
    options: [{ def: { type: 'string' } }],
  },
};

const unliteralOption = {
  def: {
    type: 'union',
    discriminator: 'kind',
    options: [
      { def: { type: 'object', shape: { kind: { def: { type: 'string' } } } } },
    ],
  },
};

function ordered(schema: { def: { type: string } }, value: unknown): string {
  return JSON.stringify(canonicalOrder(schema, value));
}

describe('canonicalOrder', () => {
  it('writes an object in the order the schema declares, not the value', () => {
    expect(
      ordered(z.object({ first: z.string(), second: z.string() }), {
        second: 'b',
        first: 'a',
      }),
    ).toBe('{"first":"a","second":"b"}');
  });

  it('leaves out a key the schema declares and the value does not carry', () => {
    expect(
      ordered(z.object({ held: z.string(), absent: z.string() }), {
        held: 'a',
      }),
    ).toBe('{"held":"a"}');
  });

  it('drops a key the schema does not declare', () => {
    expect(
      ordered(z.object({ held: z.string() }), { held: 'a', spare: 'b' }),
    ).toBe('{"held":"a"}');
  });

  it('orders every entry of a list', () => {
    expect(
      ordered(z.array(z.object({ first: z.string(), second: z.string() })), [
        { second: 'b', first: 'a' },
      ]),
    ).toBe('[{"first":"a","second":"b"}]');
  });

  it('leads a tagged variant with its discriminator', () => {
    expect(ordered(tagged, { id: 'x', kind: 'leaf' })).toBe(
      '{"kind":"leaf","id":"x"}',
    );
  });

  it('orders each variant by its own shape', () => {
    expect(ordered(tagged, { of: 'y', id: 'x', kind: 'branch' })).toBe(
      '{"kind":"branch","id":"x","of":"y"}',
    );
  });

  it('returns a value no variant claims as it stands', () => {
    expect(ordered(tagged, { id: 'x', kind: 'twig' })).toBe(
      '{"id":"x","kind":"twig"}',
    );
  });

  it('returns a value as it stands where a variant declares no shape', () => {
    expect(ordered(untaggedOption, { id: 'x', kind: 'leaf' })).toBe(
      '{"id":"x","kind":"leaf"}',
    );
  });

  it('returns a value as it stands where no variant names a tag', () => {
    expect(ordered(unliteralOption, { id: 'x', kind: 'leaf' })).toBe(
      '{"id":"x","kind":"leaf"}',
    );
  });

  it('returns what the schema does not describe as a shape as it stands', () => {
    expect(ordered(z.string(), 'plain')).toBe('"plain"');
    expect(ordered(z.object({ held: z.string() }), 'plain')).toBe('"plain"');
    expect(ordered(z.array(z.string()), 'plain')).toBe('"plain"');
    expect(ordered(tagged, 'plain')).toBe('"plain"');
  });
});
