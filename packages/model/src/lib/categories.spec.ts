import { threatCategorySchema } from './categories.js';

describe('threatCategorySchema', () => {
  const samples = [
    { methodology: 'STRIDE', category: 'elevation-of-privilege' },
    { methodology: 'LINDDUN', category: 'data-disclosure' },
    { methodology: 'CIA', category: 'availability' },
    { methodology: 'CIA-DIE', category: 'ephemeral' },
    { methodology: 'PLOT4ai', category: 'accountability-and-human-oversight' },
    {
      methodology: 'custom',
      methodologyName: 'PASTA',
      category: 'attack-modelling',
    },
  ] as const;

  it('parses one category per methodology and keeps its tag', () => {
    for (const sample of samples) {
      expect(threatCategorySchema.parse(sample).methodology).toBe(
        sample.methodology,
      );
    }
  });

  it('parses every STRIDE category', () => {
    for (const category of [
      'spoofing',
      'tampering',
      'repudiation',
      'information-disclosure',
      'denial-of-service',
      'elevation-of-privilege',
    ]) {
      expect(
        threatCategorySchema.safeParse({ methodology: 'STRIDE', category })
          .success,
      ).toBe(true);
    }
  });

  it("rejects a category outside its methodology's set", () => {
    expect(
      threatCategorySchema.safeParse({
        methodology: 'CIA',
        category: 'spoofing',
      }).success,
    ).toBe(false);
  });

  it("rejects Threat Dragon's older PLOT4ai category names", () => {
    expect(
      threatCategorySchema.safeParse({
        methodology: 'PLOT4ai',
        category: 'technique-and-processes',
      }).success,
    ).toBe(false);
  });

  it('rejects a custom category with an empty methodology name', () => {
    expect(
      threatCategorySchema.safeParse({
        methodology: 'custom',
        methodologyName: '',
        category: 'attack-modelling',
      }).success,
    ).toBe(false);
  });
});
