import { expect, test } from '@playwright/test';
import { type Point, pressOn } from './canvas-geometry.fixtures.js';
import {
  displayPeriod,
  gapsRecorded,
  nextFrame,
  recordGaps,
} from './frame-time.fixtures.js';
import {
  canvasSettled,
  nodeNamed,
  openEcluse,
  placeOf,
} from './studio.fixtures.js';

type Direction = 1 | -1;

const proxy = /^Écluse proxy, process/u;

const longGapPeriods = 1.5;
const longGapShare = 0.05;
const longestPeriods = 5;
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
const roomForTheRest = 30_000;

test('a drag of an element with flows at both ends drops no frames, after a warm-up drag', async ({
  page,
}) => {
  test.setTimeout(warmUpWithin + dragWithin + roomForTheRest);
  await openEcluse(page);
  const dragged = nodeNamed(page, proxy);
  const period = await displayPeriod(page, periodFrames);
  const longEnough = longGapPeriods * period;
  const worstAllowed = longestPeriods * period;

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
  await recordGaps(page);
  await drag(at, moves, across, dragWithin);
  const gaps = await gapsRecorded(page);
  await page.mouse.up();

  await expect.poll(() => placeOf(dragged)).not.toBe(placed);

  const long = gaps.filter((gap) => gap > longEnough).length;
  const share = gaps.length === 0 ? 1 : long / gaps.length;
  const longest = gaps.reduce((most, gap) => Math.max(most, gap), 0);
  const reading = `${gaps.length} frame gaps, ${long} over ${longGapPeriods} display periods (${(share * 100).toFixed(1)} percent), longest ${longest.toFixed(2)} ms, display period ${period.toFixed(2)} ms`;
  console.log(reading);

  expect(
    gaps.length,
    `the drag gave too few frames to judge: ${reading}`,
  ).toBeGreaterThanOrEqual(framesAtLeast);
  expect(
    share,
    `more than ${longGapShare * 100} percent of the drag's frames came late: ${reading}`,
  ).toBeLessThanOrEqual(longGapShare);
  expect(
    longest,
    `a frame came more than ${longestPeriods} display periods late: ${reading}`,
  ).toBeLessThanOrEqual(worstAllowed);
});
