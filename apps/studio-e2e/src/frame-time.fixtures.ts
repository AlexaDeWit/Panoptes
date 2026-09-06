import { type Page } from '@playwright/test';

type IntervalLog = {
  readonly afterAMove: number[];
  running: boolean;
};

declare global {
  interface Window {
    panoptesIntervalLog?: IntervalLog;
  }
}

/**
 * The nth percentile of a set of readings, by nearest rank: the smallest
 * reading that at least that share of the set falls at or under. Rank zero
 * names no reading, so an nth of zero answers the smallest.
 */
export const nthPercentile = (
  readings: readonly number[],
  nth: number,
): number => {
  const sorted = [...readings];
  sorted.sort((left, right) => left - right);
  const rank = Math.ceil((nth / 100) * sorted.length);
  return sorted.at(Math.max(rank - 1, 0)) ?? Number.NaN;
};

/**
 * The page's display period in milliseconds: the median interval between
 * animation frame callbacks over `frames` of an idle page. An animation frame
 * callback is handed the frame's own start time, so a page with nothing to do
 * reports its refresh rate and nothing else. Reading it beats assuming 60 Hz,
 * which is neither every machine's rate nor every runner's.
 */
export const displayPeriod = async (
  page: Page,
  frames: number,
): Promise<number> => {
  const idle = await page.evaluate(
    (count) =>
      new Promise<number[]>((resolve) => {
        const intervals: number[] = [];
        let previous: number | undefined = undefined;
        const step = (now: number): void => {
          if (previous !== undefined) {
            intervals.push(now - previous);
          }
          previous = now;
          if (intervals.length < count) {
            window.requestAnimationFrame(step);
          } else {
            resolve(intervals);
          }
        };
        window.requestAnimationFrame(step);
      }),
    frames,
  );
  return nthPercentile(idle, 50);
};

/**
 * Starts recording the interval between the page's animation frame callbacks,
 * until {@link intervalsRecorded} reads the recording back, and keeps only the
 * intervals that follow a frame which carried a pointer move. An interval is
 * one display period where the page kept up and a multiple of it where a frame
 * was dropped, so any main-thread work the page does raises the reading. The
 * work a pointer move causes runs in the frame that dispatched it and shows in
 * the interval after that frame, which is why a frame the gesture never
 * touched is left out rather than counted as a frame the page held.
 */
export const recordIntervals = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const log: IntervalLog = { afterAMove: [], running: true };
    window.panoptesIntervalLog = log;
    const listening = new AbortController();
    let moveSeen = false;
    let previousCarriedMove = false;
    let previous: number | undefined = undefined;
    window.addEventListener(
      'pointermove',
      () => {
        moveSeen = true;
      },
      { capture: true, signal: listening.signal },
    );
    const step = (now: number): void => {
      if (previous !== undefined && previousCarriedMove) {
        log.afterAMove.push(now - previous);
      }
      previousCarriedMove = moveSeen;
      moveSeen = false;
      previous = now;
      if (log.running) {
        window.requestAnimationFrame(step);
      } else {
        listening.abort();
      }
    };
    window.requestAnimationFrame(step);
  });
};

/** Stops the recording {@link recordIntervals} started and reads it back. */
export const intervalsRecorded = async (
  page: Page,
): Promise<readonly number[]> => {
  const recorded = await page.evaluate(() => {
    const log = window.panoptesIntervalLog;
    window.panoptesIntervalLog = undefined;
    if (log === undefined) {
      return [];
    }
    log.running = false;
    return [...log.afterAMove];
  });
  return recorded;
};

/**
 * Resolves on the page's next animation frame. A gesture paced with this waits
 * for the page to have drawn before it sends the next pointer move, rather
 * than sending moves as fast as the test protocol carries them. It does not
 * make one move per frame: the protocol's own round trip costs frames of its
 * own, so more than one frame passes between two moves.
 */
export const nextFrame = async (page: Page): Promise<void> => {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          resolve();
        });
      }),
  );
};
