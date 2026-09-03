import {
  centreOf,
  handlePositions,
  handleSides,
  nearestHandleSide,
  type NodeBox,
} from './handles.js';

const box: NodeBox = {
  position: { x: 40, y: 60 },
  size: { width: 160, height: 80 },
};

const wider: NodeBox = {
  position: { x: 40, y: 60 },
  size: { width: 400, height: 200 },
};

const square: NodeBox = {
  position: { x: 0, y: 0 },
  size: { width: 100, height: 100 },
};

const midpointsOf = (of: NodeBox) => ({
  top: { x: of.position.x + of.size.width / 2, y: of.position.y },
  right: {
    x: of.position.x + of.size.width,
    y: of.position.y + of.size.height / 2,
  },
  bottom: {
    x: of.position.x + of.size.width / 2,
    y: of.position.y + of.size.height,
  },
  left: { x: of.position.x, y: of.position.y + of.size.height / 2 },
});

describe('centreOf', () => {
  it('is the middle of the model position and size', () => {
    expect(centreOf(box)).toEqual({ x: 120, y: 100 });
  });
});

describe('handlePositions', () => {
  it('places a handle at the midpoint of each side', () => {
    expect(handlePositions(box)).toEqual(midpointsOf(box));
  });

  it('follows the model when the size changes', () => {
    expect(handlePositions(wider)).toEqual(midpointsOf(wider));
    expect(handlePositions(wider)).not.toEqual(handlePositions(box));
  });

  it('carries one position for every side', () => {
    expect(new Set(Object.keys(handlePositions(box)))).toEqual(
      new Set<string>(handleSides),
    );
  });
});

describe('nearestHandleSide', () => {
  it('picks the side whose midpoint lies nearest the point', () => {
    expect(nearestHandleSide(square, { x: 300, y: 50 })).toBe('right');
    expect(nearestHandleSide(square, { x: 50, y: -300 })).toBe('top');
    expect(nearestHandleSide(square, { x: 50, y: 300 })).toBe('bottom');
    expect(nearestHandleSide(square, { x: -300, y: 50 })).toBe('left');
  });

  it('breaks a four-way tie on the first side of the order', () => {
    expect(nearestHandleSide(square, centreOf(square))).toBe(handleSides[0]);
  });

  it('breaks a two-way tie on the earlier side of the order', () => {
    expect(nearestHandleSide(square, { x: 100, y: 100 })).toBe('right');
    expect(nearestHandleSide(square, { x: 0, y: 100 })).toBe('bottom');
  });

  it('breaks a tie the same way however often it is asked', () => {
    const answers = new Set(
      Array.from({ length: 20 }, () =>
        nearestHandleSide(square, centreOf(square)),
      ),
    );
    expect([...answers]).toEqual(['top']);
  });
});
