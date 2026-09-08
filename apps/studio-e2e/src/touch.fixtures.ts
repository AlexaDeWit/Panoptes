import type { CDPSession, Page } from '@playwright/test';
import type { Point } from './canvas-geometry.fixtures.js';

const touchPoint = (at: Point) => ({
  x: Math.round(at.x),
  y: Math.round(at.y),
  id: 1,
});

/** Enables touch input on a Chromium debugging session. */
export const touchSession = async (page: Page): Promise<CDPSession> => {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 2,
  });
  return session;
};

/** Sends a touch gesture between screen coordinates, including a stationary tap. */
export const touchDrag = async (
  session: CDPSession,
  from: Point,
  to: Point,
): Promise<void> => {
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(from)],
  });
  for (let step = 1; step <= 6; step += 1) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        touchPoint({
          x: from.x + ((to.x - from.x) * step) / 6,
          y: from.y + ((to.y - from.y) * step) / 6,
        }),
      ],
    });
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
};
