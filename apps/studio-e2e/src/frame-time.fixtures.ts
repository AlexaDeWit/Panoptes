import { type Page } from '@playwright/test';

type FrameLog = {
  readonly costs: number[];
  running: boolean;
};

declare global {
  interface Window {
    panoptesFrameLog?: FrameLog;
  }
}

/**
 * Starts recording what each of the page's animation frames costs its main
 * thread, in milliseconds, until {@link framesRecorded} reads the recording
 * back. A frame is timed from its animation frame callback to the task that
 * runs once the frame is done, which a message port carries: a message posted
 * from inside a frame callback is handled after that frame's style, layout
 * and paint. A reading is therefore the work the frame did rather than the
 * wait for the next one, and a reading under the display's period is a frame
 * with room left in its budget.
 */
export const recordFrames = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const log: FrameLog = { costs: [], running: true };
    window.panoptesFrameLog = log;
    const opened: number[] = [];
    const frames = new MessageChannel();
    frames.port1.addEventListener('message', () => {
      const started = opened.shift();
      if (started !== undefined) {
        log.costs.push(performance.now() - started);
      }
    });
    frames.port1.start();
    const step = (): void => {
      opened.push(performance.now());
      frames.port2.postMessage(0);
      if (log.running) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  });
};

/** Stops the recording {@link recordFrames} started and reads it back. */
export const framesRecorded = (page: Page): Promise<readonly number[]> =>
  page.evaluate(() => {
    const log = window.panoptesFrameLog;
    window.panoptesFrameLog = undefined;
    if (log === undefined) {
      return [];
    }
    log.running = false;
    return [...log.costs];
  });

/**
 * Resolves on the page's next animation frame. A caller driving a gesture
 * sends one pointer move per frame this way, which is the rate a browser
 * hands a real pointer's moves to a page, rather than as fast as the test
 * protocol carries them.
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
