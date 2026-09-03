import { arrowheadPath, polylinePath, smoothPath, translate } from './paths.js';

describe('translate', () => {
  it('writes the point as an SVG transform', () => {
    expect(translate({ x: 40, y: -12.5 })).toBe('translate(40, -12.5)');
  });
});

describe('polylinePath', () => {
  it('moves to the first point and draws to the rest', () => {
    expect(
      polylinePath([
        { x: 0, y: 0 },
        { x: 10, y: 20 },
        { x: 30, y: 20 },
      ]),
    ).toBe('M 0 0 L 10 20 L 30 20');
  });

  it('draws nothing through no points', () => {
    expect(polylinePath([])).toBe('');
  });
});

describe('smoothPath', () => {
  it('draws a cubic segment between each pair of waypoints', () => {
    expect(
      smoothPath([
        { x: 0, y: 0 },
        { x: 100, y: 40 },
        { x: 200, y: 0 },
      ]),
    ).toBe(
      'M 0 0 C 16.667 6.667 66.667 40 100 40 ' +
        'C 133.333 40 183.333 6.667 200 0',
    );
  });

  it('gives the same path for the same waypoints every time', () => {
    const waypoints = [
      { x: 0, y: 0 },
      { x: 100, y: 40 },
      { x: 200, y: 0 },
    ];
    expect(smoothPath(waypoints)).toBe(smoothPath(waypoints));
  });

  it('joins a pair of waypoints as one segment', () => {
    expect(
      smoothPath([
        { x: 0, y: 0 },
        { x: 60, y: 0 },
      ]),
    ).toBe('M 0 0 C 10 0 50 0 60 0');
  });

  it('falls back to straight segments where there is nothing to smooth', () => {
    expect(smoothPath([{ x: 5, y: 5 }])).toBe('M 5 5');
  });
});

describe('arrowheadPath', () => {
  it('points along the segment it ends', () => {
    expect(arrowheadPath({ x: 100, y: 0 }, { x: 0, y: 0 })).toBe(
      'M 100 0 L 88 5 L 88 -5 Z',
    );
  });

  it('turns with the segment', () => {
    expect(arrowheadPath({ x: 0, y: 100 }, { x: 0, y: 0 })).toBe(
      'M 0 100 L -5 88 L 5 88 Z',
    );
  });

  it('points to the right where the segment has no length', () => {
    expect(arrowheadPath({ x: 40, y: 40 }, { x: 40, y: 40 })).toBe(
      'M 40 40 L 28 45 L 28 35 Z',
    );
  });
});
