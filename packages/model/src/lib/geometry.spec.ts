import { pointSchema, sizeSchema, waypointsSchema } from './geometry.js';

describe('pointSchema', () => {
  it('parses integer coordinates', () => {
    expect(pointSchema.parse({ x: 1480, y: 860 })).toEqual({
      x: 1480,
      y: 860,
    });
  });

  it('parses fractional and negative coordinates', () => {
    expect(pointSchema.safeParse({ x: -3.5, y: 0 }).success).toBe(true);
  });

  it('rejects a missing coordinate', () => {
    expect(pointSchema.safeParse({ x: 4 }).success).toBe(false);
  });

  it('rejects NaN and infinite coordinates', () => {
    expect(pointSchema.safeParse({ x: Number.NaN, y: 0 }).success).toBe(false);
    expect(
      pointSchema.safeParse({ x: 0, y: Number.POSITIVE_INFINITY }).success,
    ).toBe(false);
  });

  it('rejects an unknown key', () => {
    expect(pointSchema.safeParse({ x: 1, y: 2, z: 3 }).success).toBe(false);
  });
});

describe('sizeSchema', () => {
  it('parses a positive extent', () => {
    expect(sizeSchema.safeParse({ width: 170, height: 90 }).success).toBe(true);
  });

  it('rejects zero and negative extents', () => {
    expect(sizeSchema.safeParse({ width: 0, height: 90 }).success).toBe(false);
    expect(sizeSchema.safeParse({ width: 170, height: -1 }).success).toBe(
      false,
    );
  });
});

describe('waypointsSchema', () => {
  it('parses an empty list', () => {
    expect(waypointsSchema.parse([])).toEqual([]);
  });

  it('parses points in order', () => {
    expect(
      waypointsSchema.parse([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ]),
    ).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
  });

  it('rejects an entry that is not a point', () => {
    expect(waypointsSchema.safeParse([{ x: 1 }]).success).toBe(false);
  });
});
