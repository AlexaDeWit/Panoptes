import { pointSchema, sizeSchema, waypointsSchema } from './geometry.js';

describe('pointSchema', () => {
  it('accepts negative and fractional coordinates', () => {
    expect(pointSchema.parse({ x: -3.5, y: 860 })).toEqual({ x: -3.5, y: 860 });
  });

  it('rejects an unknown key', () => {
    expect(pointSchema.safeParse({ x: 1, y: 2, z: 3 }).success).toBe(false);
  });
});

describe('sizeSchema', () => {
  it('accepts a positive extent', () => {
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
  it('accepts points in order', () => {
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
});
