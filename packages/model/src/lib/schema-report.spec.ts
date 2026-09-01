import { z } from 'zod';
import { renderModelSchema, renderSchema } from './schema-report.js';

const malformed = {
  def: {
    type: 'object',
    shape: {
      bounded: {
        def: {
          type: 'number',
          checks: [{ _zod: { def: { check: 'greater_than' } } }],
        },
      },
      counted: {
        def: {
          type: 'string',
          checks: [{ _zod: { def: { check: 'min_length' } } }],
        },
      },
    },
  },
};

describe('renderModelSchema', () => {
  it('matches the schema document committed beside the package', async () => {
    await expect(renderModelSchema()).toMatchFileSnapshot('../../SCHEMA.md');
  });
});

describe('renderSchema', () => {
  it('reads a bound from each end rather than from the number alone', () => {
    expect(
      renderSchema(
        z.strictObject({
          span: z.number().min(1).max(9),
          open: z.number().gt(1).lt(9),
          text: z.string().min(1).max(8),
        }),
      ),
    ).toBe(
      [
        '- `span`: number, 1 or more, 9 or less',
        '- `open`: number, greater than 1, less than 9',
        '- `text`: string, at least 1 character, at most 8 characters',
      ].join('\n'),
    );
  });

  it('leaves a constraint it has no words for undescribed', () => {
    expect(
      renderSchema(
        z.strictObject({
          stepped: z.number().multipleOf(5),
          matched: z.string().regex(/^a+$/),
        }),
      ),
    ).toBe(['- `stepped`: number', '- `matched`: string'].join('\n'));
  });

  it('leaves a bound carrying no number undescribed rather than guessed at', () => {
    expect(renderSchema(malformed)).toBe(
      ['- `bounded`: number', '- `counted`: string'].join('\n'),
    );
  });

  it('names a union with no discriminator by its size alone', () => {
    expect(
      renderSchema(z.strictObject({ either: z.union([z.string(), z.int()]) })),
    ).toBe('- `either`: one of 2');
  });

  it('names every value a literal admits', () => {
    expect(
      renderSchema(z.strictObject({ side: z.literal(['left', 'right']) })),
    ).toBe('- `side`: `left` or `right`');
  });
});
