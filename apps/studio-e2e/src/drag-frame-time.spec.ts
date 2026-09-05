import { expect, test } from '@playwright/test';
import { type Point, pressOn } from './canvas-geometry.fixtures.js';
import {
  framesRecorded,
  nextFrame,
  nthPercentile,
  recordFrames,
} from './frame-time.fixtures.js';
import { nodeNamed, openEcluse, placeOf } from './studio.fixtures.js';

const proxy = /^Écluse proxy, process/u;

const hertz = 60;
const oneFrame = 1000 / hertz;
const twoFrames = 2 * oneFrame;
const percentile = 95;
const framesAtLeast = 60;

const moves = 90;
const warmUpMoves = 30;
const rightPerMove = 4;
const downPerMove = 1;
const across = 1;
const back = -1;

test('a drag of an element with flows at both ends holds the frame budget, after a warm-up drag', async ({
  page,
}) => {
  await openEcluse(page);
  const dragged = nodeNamed(page, proxy);

  const drag = async (
    from: Point,
    count: number,
    way: number,
  ): Promise<void> => {
    for (let move = 1; move <= count; move += 1) {
      await page.mouse.move(
        from.x + way * move * rightPerMove,
        from.y + way * move * downPerMove,
      );
      await nextFrame(page);
    }
  };

  const warm = await pressOn(page, dragged);
  await drag(warm, warmUpMoves, back);
  await page.mouse.up();
  const placed = await placeOf(dragged);

  const at = await pressOn(page, dragged);
  await recordFrames(page);
  await drag(at, moves, across);
  const costs = await framesRecorded(page);
  await page.mouse.up();

  await expect.poll(() => placeOf(dragged)).not.toBe(placed);
  expect(
    costs.length,
    'animation frames sampled across the drag',
  ).toBeGreaterThanOrEqual(framesAtLeast);

  const busiest = nthPercentile(costs, percentile);
  const longest = Math.max(...costs);
  console.log(
    `frame time over ${costs.length} frames: ${percentile}th percentile ${busiest.toFixed(2)} ms, longest ${longest.toFixed(2)} ms`,
  );

  expect(
    busiest,
    `the ${percentile}th percentile frame took ${busiest.toFixed(2)} ms of the ${oneFrame.toFixed(2)} ms a frame has at ${hertz} Hz`,
  ).toBeLessThan(oneFrame);
  expect(
    longest,
    `the longest frame took ${longest.toFixed(2)} ms, over the ${twoFrames.toFixed(2)} ms two frames at ${hertz} Hz allow`,
  ).toBeLessThan(twoFrames);
});
