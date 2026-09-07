import {
  minimumNodeExtent,
  resizeBoxByKey,
  resizeBoxOnControlAxes,
  type ResizeControlPosition,
} from './resizing.js';

const box = {
  position: { x: 100, y: 200 },
  size: { width: 120, height: 60 },
};

const cases = [
  [
    'top',
    'ArrowUp',
    { position: { x: 100, y: 195 }, size: { width: 120, height: 65 } },
  ],
  [
    'right',
    'ArrowRight',
    { position: { x: 100, y: 200 }, size: { width: 125, height: 60 } },
  ],
  [
    'bottom',
    'ArrowDown',
    { position: { x: 100, y: 200 }, size: { width: 120, height: 65 } },
  ],
  [
    'left',
    'ArrowLeft',
    { position: { x: 95, y: 200 }, size: { width: 125, height: 60 } },
  ],
] as const satisfies readonly (readonly [
  ResizeControlPosition,
  string,
  typeof box,
])[];

describe('resizeBoxByKey', () => {
  it.each(cases)(
    'resizes from the %s with the opposite side fixed',
    (_, key, expected) => {
      expect(resizeBoxByKey(box, _, key)).toEqual(expected);
    },
  );

  it('lets a corner resize both axes', () => {
    const widened = resizeBoxByKey(box, 'top-left', 'ArrowLeft');
    expect(widened).toEqual({
      position: { x: 95, y: 200 },
      size: { width: 125, height: 60 },
    });
    expect(widened && resizeBoxByKey(widened, 'top-left', 'ArrowUp')).toEqual({
      position: { x: 95, y: 195 },
      size: { width: 125, height: 65 },
    });
  });

  it('clamps every side at the minimum extent', () => {
    const small = {
      position: box.position,
      size: { width: minimumNodeExtent + 2, height: minimumNodeExtent + 2 },
    };
    expect(resizeBoxByKey(small, 'left', 'ArrowRight', 20)).toEqual({
      position: { x: 102, y: 200 },
      size: { width: minimumNodeExtent, height: minimumNodeExtent + 2 },
    });
    expect(resizeBoxByKey(small, 'right', 'ArrowLeft', 20)).toEqual({
      position: box.position,
      size: { width: minimumNodeExtent, height: minimumNodeExtent + 2 },
    });
    expect(resizeBoxByKey(small, 'top', 'ArrowDown', 20)).toEqual({
      position: { x: 100, y: 202 },
      size: { width: minimumNodeExtent + 2, height: minimumNodeExtent },
    });
    expect(resizeBoxByKey(small, 'bottom', 'ArrowUp', 20)).toEqual({
      position: box.position,
      size: { width: minimumNodeExtent + 2, height: minimumNodeExtent },
    });
  });

  it('ignores a key outside the control axis', () => {
    expect(resizeBoxByKey(box, 'top', 'ArrowLeft')).toBeUndefined();
    expect(resizeBoxByKey(box, 'left', 'Enter')).toBeUndefined();
  });
});

describe('resizeBoxOnControlAxes', () => {
  const measured = {
    position: { x: 90, y: 190 },
    size: { width: 140, height: 80 },
  };

  it('keeps the vertical values of a horizontal side resize', () => {
    expect(resizeBoxOnControlAxes(box, 'left', measured)).toEqual({
      position: { x: 90, y: 200 },
      size: { width: 140, height: 60 },
    });
  });

  it('keeps the horizontal values of a vertical side resize', () => {
    expect(resizeBoxOnControlAxes(box, 'top', measured)).toEqual({
      position: { x: 100, y: 190 },
      size: { width: 120, height: 80 },
    });
  });

  it('keeps both axes of a corner resize', () => {
    expect(resizeBoxOnControlAxes(box, 'top-left', measured)).toBe(measured);
  });
});
