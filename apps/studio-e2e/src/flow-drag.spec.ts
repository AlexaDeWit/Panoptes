import { expect, test } from '@playwright/test';
import {
  boxOf,
  drawnBy,
  endsOn,
  handlesOf,
  lineOf,
  pressOn,
} from './canvas-geometry.fixtures.js';
import { nodeNamed, openEcluse, placeOf } from './studio.fixtures.js';

const proxy = /^Écluse proxy, process/u;
const outward = /^cache public-gated metadata, flow/u;
const inward = /^Download osv\.db, flow/u;
const elsewhere = /^poll jobs, flow/u;

test('a flow follows the element it attaches to through a drag, at either end', async ({
  page,
}) => {
  await openEcluse(page);
  const dragged = nodeNamed(page, proxy);
  const attached = [lineOf(page, outward), lineOf(page, inward)];
  const detached = lineOf(page, elsewhere);
  const settled = await Promise.all(attached.map(drawnBy));
  const untouched = await drawnBy(detached);
  const placed = await placeOf(dragged);

  const at = await pressOn(page, dragged);
  await page.mouse.move(at.x + 70, at.y + 55, { steps: 8 });
  await expect.poll(() => placeOf(dragged)).not.toBe(placed);

  const handles = handlesOf(await boxOf(dragged));
  const inFlight = await Promise.all(attached.map(drawnBy));
  for (const [index, drawn] of inFlight.entries()) {
    expect(drawn, 'the flow was redrawn during the drag').not.toBe(
      settled[index],
    );
    expect(
      endsOn(drawn, handles),
      `${drawn} ends on a handle of ${JSON.stringify(handles)}`,
    ).toHaveLength(1);
  }
  expect(
    await drawnBy(detached),
    'a flow attached to neither end stayed where it was',
  ).toBe(untouched);

  await page.mouse.up();

  for (const [index, line] of attached.entries()) {
    await expect(line).toHaveAttribute('d', inFlight[index]);
  }
});
