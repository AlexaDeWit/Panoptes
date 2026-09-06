import { type Page } from '@playwright/test';

type GapLog = {
  readonly readings: number[];
  running: boolean;
  handle: number;
};

declare global {
  interface Window {
    saerskrivenGapLog?: GapLog;
  }
}

const median = (readings: readonly number[]): number => {
  const sorted = [...readings];
  sorted.sort((left, right) => left - right);
  return sorted.at(Math.floor(sorted.length / 2)) ?? Number.NaN;
};

const gapsBetween = (readings: readonly number[]): readonly number[] =>
  readings.slice(1).map((reading, index) => reading - readings[index]);

/**
 * The page's display period in milliseconds: the median gap between animation
 * frame callbacks over `frames` of an idle page, read by the same clock the
 * drag is measured with. Reading it beats assuming 60 Hz, which is neither
 * every machine's rate nor every runner's.
 */
export const displayPeriod = async (
  page: Page,
  frames: number,
): Promise<number> => {
  const idle = await page.evaluate(
    (count) =>
      new Promise<number[]>((resolve) => {
        const readings: number[] = [];
        const step = (): void => {
          readings.push(performance.now());
          if (readings.length <= count) {
            window.requestAnimationFrame(step);
          } else {
            resolve(readings);
          }
        };
        window.requestAnimationFrame(step);
      }),
    frames,
  );
  return median(gapsBetween(idle));
};

/**
 * Starts recording `performance.now()` at the top of every animation frame
 * callback, until {@link gapsRecorded} reads the recording back. The clock is
 * read rather than the timestamp the callback is handed, because in headless
 * Chromium that argument is the frame's nominal slot on a fixed grid: a frame
 * delivered late still carries the slot it was meant for, so work that holds
 * the main thread leaves the argument unchanged and the clock shows it.
 */
export const recordGaps = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const replaced = window.saerskrivenGapLog;
    if (replaced !== undefined) {
      replaced.running = false;
      window.cancelAnimationFrame(replaced.handle);
    }
    const log: GapLog = { readings: [], running: true, handle: 0 };
    window.saerskrivenGapLog = log;
    const step = (): void => {
      log.readings.push(performance.now());
      if (log.running) {
        log.handle = window.requestAnimationFrame(step);
      }
    };
    log.handle = window.requestAnimationFrame(step);
  });
};

/**
 * Stops the recording {@link recordGaps} started and answers the gaps between
 * the frames it saw.
 */
export const gapsRecorded = async (page: Page): Promise<readonly number[]> => {
  const readings = await page.evaluate(() => {
    const log = window.saerskrivenGapLog;
    window.saerskrivenGapLog = undefined;
    if (log === undefined) {
      return [];
    }
    log.running = false;
    return [...log.readings];
  });
  return gapsBetween(readings);
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
