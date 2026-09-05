import {
  boxesOverlap,
  boxMeetsCircle,
  boxOfPoints,
  cornersOfBox,
  segmentMeetsBox,
  segmentsOfBox,
  segmentsOfPolyline,
  shiftedBy,
  type Box,
  type Circle,
} from './geometry.js';

const unitBox: Box = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

const unitCircle: Circle = { centre: { x: 50, y: 50 }, radius: 50 };

describe('boxOfPoints', () => {
  it('holds every point it is given', () => {
    expect(
      boxOfPoints([
        { x: 10, y: -4 },
        { x: -6, y: 30 },
      ]),
    ).toEqual({ minX: -6, minY: -4, maxX: 10, maxY: 30 });
  });

  it('gives no box for no points', () => {
    expect(boxOfPoints([])).toBeUndefined();
  });
});

describe('segmentsOfPolyline', () => {
  it('runs one segment between each pair in turn', () => {
    expect(
      segmentsOfPolyline([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toEqual([
      { from: { x: 0, y: 0 }, to: { x: 10, y: 0 } },
      { from: { x: 10, y: 0 }, to: { x: 10, y: 10 } },
    ]);
  });

  it('runs nothing between one point and itself alone', () => {
    expect(segmentsOfPolyline([{ x: 0, y: 0 }])).toEqual([]);
  });
});

describe('segmentsOfBox', () => {
  it('closes the four sides back on the corner it started from', () => {
    const sides = segmentsOfBox(unitBox);
    expect(sides).toHaveLength(4);
    expect(sides[3].to).toEqual(sides[0].from);
  });
});

describe('cornersOfBox and shiftedBy', () => {
  it('names the four corners and moves a point by an offset', () => {
    expect(cornersOfBox(unitBox)).toHaveLength(4);
    expect(shiftedBy({ x: 1, y: 2 }, { x: 10, y: 20 })).toEqual({
      x: 11,
      y: 22,
    });
  });
});

describe('boxesOverlap', () => {
  it('counts a shared edge as an overlap', () => {
    expect(
      boxesOverlap(unitBox, { minX: 100, minY: 0, maxX: 200, maxY: 100 }),
    ).toBe(true);
  });

  it('leaves a box beside it clear', () => {
    expect(
      boxesOverlap(unitBox, { minX: 101, minY: 0, maxX: 200, maxY: 100 }),
    ).toBe(false);
  });
});

describe('boxMeetsCircle', () => {
  it('meets a box the circle reaches into', () => {
    expect(
      boxMeetsCircle({ minX: 40, minY: -50, maxX: 60, maxY: 10 }, unitCircle),
    ).toBe(true);
  });

  it('counts a box its edge only touches', () => {
    expect(
      boxMeetsCircle({ minX: 100, minY: 40, maxX: 120, maxY: 60 }, unitCircle),
    ).toBe(true);
  });

  it('leaves a box in the corner of its bounding square clear', () => {
    const corner: Box = { minX: 90, minY: 90, maxX: 100, maxY: 100 };
    expect(boxesOverlap(corner, unitBox)).toBe(true);
    expect(boxMeetsCircle(corner, unitCircle)).toBe(false);
  });
});

describe('segmentMeetsBox', () => {
  it('meets a box it runs through', () => {
    expect(
      segmentMeetsBox(
        { from: { x: -50, y: 50 }, to: { x: 150, y: 50 } },
        unitBox,
      ),
    ).toBe(true);
  });

  it('meets a box it ends inside', () => {
    expect(
      segmentMeetsBox(
        { from: { x: -50, y: 50 }, to: { x: 50, y: 50 } },
        unitBox,
      ),
    ).toBe(true);
  });

  it('clears a box it passes beside', () => {
    expect(
      segmentMeetsBox(
        { from: { x: -50, y: 200 }, to: { x: 150, y: 200 } },
        unitBox,
      ),
    ).toBe(false);
  });

  it('clears a box whose corner a diagonal passes outside of', () => {
    expect(
      segmentMeetsBox(
        { from: { x: 140, y: 80 }, to: { x: 80, y: 140 } },
        unitBox,
      ),
    ).toBe(false);
  });

  it('reads a run of no length as the point it stands at', () => {
    expect(
      segmentMeetsBox(
        { from: { x: 50, y: 50 }, to: { x: 50, y: 50 } },
        unitBox,
      ),
    ).toBe(true);
    expect(
      segmentMeetsBox(
        { from: { x: 500, y: 50 }, to: { x: 500, y: 50 } },
        unitBox,
      ),
    ).toBe(false);
  });
});
