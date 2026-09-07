import { expect, type Locator, type Page } from '@playwright/test';

/** A node's box in the diagram's own coordinates. */
export type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** One point in the diagram's own coordinates. */
export type Point = { readonly x: number; readonly y: number };

const decimals = 3;
const coordinateTolerance = 0.01;

const rounded = (point: Point): Point => ({
  x: Number(point.x.toFixed(decimals)),
  y: Number(point.y.toFixed(decimals)),
});

const numberIn = (style: string, pattern: RegExp): number =>
  Number(pattern.exec(style)?.[1] ?? Number.NaN);

/**
 * The box React Flow is drawing a node in, read off the style attribute it
 * places and sizes the node with. It is the live one: a drag frame reaches a
 * node's style long before it reaches the store, so this is where an element
 * is during a gesture.
 */
export const boxOf = async (node: Locator): Promise<Box> => {
  const style = (await node.getAttribute('style')) ?? '';
  return {
    x: numberIn(style, /translate\((-?[\d.]+)px/u),
    y: numberIn(style, /translate\(-?[\d.]+px,\s*(-?[\d.]+)px/u),
    width: numberIn(style, /width:\s*([\d.]+)px/u),
    height: numberIn(style, /height:\s*([\d.]+)px/u),
  };
};

/** The screen-space box of SVG shape ink, including its stroke. */
export const inkBoxOf = async (shapes: Locator): Promise<Box> =>
  shapes.evaluateAll((elements) => {
    const boxes = elements.map((element) => {
      if (!(element instanceof SVGGraphicsElement)) {
        throw new Error('The locator found a non-SVG shape.');
      }
      const drawn = element.getBoundingClientRect();
      const stroke = Number.parseFloat(getComputedStyle(element).strokeWidth);
      const matrix = element.getScreenCTM();
      const scaleX = Math.hypot(matrix?.a ?? 1, matrix?.b ?? 0);
      const scaleY = Math.hypot(matrix?.c ?? 0, matrix?.d ?? 1);
      const horizontalLine =
        element instanceof SVGLineElement &&
        element.x1.baseVal.value !== element.x2.baseVal.value;
      const verticalLine =
        element instanceof SVGLineElement &&
        element.y1.baseVal.value !== element.y2.baseVal.value;
      const padX =
        verticalLine || !(element instanceof SVGLineElement)
          ? (stroke * scaleX) / 2
          : 0;
      const padY =
        horizontalLine || !(element instanceof SVGLineElement)
          ? (stroke * scaleY) / 2
          : 0;
      return {
        left: drawn.left - padX,
        top: drawn.top - padY,
        right: drawn.right + padX,
        bottom: drawn.bottom + padY,
      };
    });
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    return { x: left, y: top, width: right - left, height: bottom - top };
  });

/** Where a flow attached to that box ends: one of the four side midpoints. */
export const handlesOf = (box: Box): Point[] =>
  [
    { x: box.x + box.width / 2, y: box.y },
    { x: box.x + box.width, y: box.y + box.height / 2 },
    { x: box.x + box.width / 2, y: box.y + box.height },
    { x: box.x, y: box.y + box.height / 2 },
  ].map(rounded);

/** The line one flow draws, from its source through its waypoints. */
export const lineOf = (page: Page, name: RegExp): Locator =>
  page.getByRole('group', { name }).locator('path.pn-flow');

/** The screen point halfway along a drawn flow. */
export const halfwayAlong = (line: Locator): Promise<Point> =>
  line.evaluate<Point, SVGPathElement>((path) => {
    const along = path.getPointAtLength(path.getTotalLength() / 2);
    const point = new DOMPoint(along.x, along.y).matrixTransform(
      path.getScreenCTM() ?? new DOMMatrix(),
    );
    return { x: point.x, y: point.y };
  });

/** The path a line is drawn along, as the `d` attribute carries it. */
export const drawnBy = async (line: Locator): Promise<string> =>
  (await line.getAttribute('d')) ?? '';

const turnsOf = (drawn: string): Point[] =>
  [...drawn.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/gu)].map((turn) =>
    rounded({ x: Number(turn[1]), y: Number(turn[2]) }),
  );

/** Which of a line's turns sit on one of the handles offered. */
export const endsOn = (drawn: string, handles: readonly Point[]): Point[] =>
  turnsOf(drawn).filter((turn) =>
    handles.some(
      (handle) =>
        Math.abs(handle.x - turn.x) <= coordinateTolerance &&
        Math.abs(handle.y - turn.y) <= coordinateTolerance,
    ),
  );

/**
 * Presses the pointer on the centre of a node and answers where it landed,
 * leaving the button down so the caller can move and read before the drop.
 */
export const pressOn = async (page: Page, node: Locator): Promise<Point> => {
  const surface = await node.boundingBox();
  expect(surface).not.toBeNull();
  const at = {
    x: (surface?.x ?? 0) + (surface?.width ?? 0) / 2,
    y: (surface?.y ?? 0) + (surface?.height ?? 0) / 2,
  };
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  return at;
};
