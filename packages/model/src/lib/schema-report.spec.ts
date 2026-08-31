import { z } from 'zod';
import { renderModelSchema, renderSchema } from './schema-report.js';

describe('renderModelSchema', () => {
  it('matches the schema document committed beside the package', async () => {
    await expect(renderModelSchema()).toMatchFileSnapshot('../../SCHEMA.md');
  });
});

describe('renderSchema', () => {
  it('leaves a constraint it has no words for undescribed', () => {
    expect(
      renderSchema(z.strictObject({ code: z.string().regex(/^a+$/) })),
    ).toBe('- `code`: string');
  });
});
