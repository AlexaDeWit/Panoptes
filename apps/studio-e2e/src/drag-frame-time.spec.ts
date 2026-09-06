import { expect, test } from '@playwright/test';
import { type Point, pressOn } from './canvas-geometry.fixtures.js';
import {
  displayPeriod,
  intervalsRecorded,
  nextFrame,
  nthPercentile,
  recordIntervals,
} from './frame-time.fixtures.js';
import {
  canvasSettled,
  nodeNamed,
  openEcluse,
  placeOf,
} from './studio.fixtures.js';

type Direction = 1 | -1;

const proxy = /^Écluse proxy, process/u;

const percentile = 95;
const percentilePeriods = 1.5;
const longestPeriods = 3;
const framesAtLeast = 60;
const periodFrames = 20;

const moves = 90;
const warmUpMoves = 30;
const rightPerMove = 4;
const downPerMove = 1;
const across: Direction = 1;
const back: Direction = -1;
const dragWithin = 12_000;
const warmUpWithin = 6_000;
const openingWithin = 30_000;

test('a drag of an element with flows at both ends drops no frames, after a warm-up drag', async ({
  page,
}) => {
  test.setTimeout(openingWithin + warmUpWithin + dragWithin);
  await openEcluse(page);
  const dragged = nodeNamed(page, proxy);
  const period = await displayPeriod(page, periodFrames);

  const drag = async (
    from: Point,
    count: number,
    way: Direction,
    within: number,
  ): Promise<void> => {
    const deadline = Date.now() + within;
    for (let move = 1; move <= count && Date.now() < deadline; move += 1) {
      await page.mouse.move(
        from.x + way * move * rightPerMove,
        from.y + way * move * downPerMove,
      );
      await nextFrame(page);
    }
  };

  const warm = await pressOn(page, dragged);
  await drag(warm, warmUpMoves, back, warmUpWithin);
  await page.mouse.up();
  await canvasSettled(page);
  const placed = await placeOf(dragged);

  const at = await pressOn(page, dragged);
  await recordIntervals(page);
  await drag(at, moves, across, dragWithin);
  const intervals = await intervalsRecorded(page);
  await page.mouse.up();

  await expect.poll(() => placeOf(dragged)).not.toBe(placed);

  const busiest = nthPercentile(intervals, percentile);
  const longest = intervals.reduce((most, each) => Math.max(most, each), 0);
  const reading = `${intervals.length} intervals after a pointer move, ${percentile}th percentile ${busiest.toFixed(2)} ms, longest ${longest.toFixed(2)} ms, display period ${period.toFixed(2)} ms`;
  console.log(reading);

  expect(
    intervals.length,
    `the drag gave too few frames to judge: ${reading}`,
  ).toBeGreaterThanOrEqual(framesAtLeast);
  expect(
    busiest,
    `the ${percentile}th percentile interval is over ${percentilePeriods} display periods: ${reading}`,
  ).toBeLessThan(percentilePeriods * period);
  expect(
    longest,
    `an interval is over ${longestPeriods} display periods: ${reading}`,
  ).toBeLessThanOrEqual(longestPeriods * period);
});
