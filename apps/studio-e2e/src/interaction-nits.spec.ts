import { expect, test, type Page } from '@playwright/test';
import { touchDrag, touchSession } from './touch.fixtures.js';
import { viewportTransform } from './commands.fixtures.js';
import { registeredChords } from './chords.js';
import {
  canvasSurface,
  emptyCanvasPoint,
  nodeNamed,
  openPlaceholder,
  toolButton,
} from './studio.fixtures.js';

type Point = { readonly x: number; readonly y: number };

const scaleOf = (transform: string): number =>
  Number(/scale\(([\d.]+)\)/u.exec(transform)?.[1]);

const movedPoint = (page: Page, from: Point): Point => {
  const width = page.viewportSize()?.width ?? 0;
  return {
    x: from.x + (from.x < width / 2 ? 100 : -100),
    y: from.y + 60,
  };
};

test('the startup canvas has no transient hint', async ({ page }) => {
  await openPlaceholder(page);

  await expect(page.getByTestId('empty-state-hint')).toHaveCount(0);
});

test('scroll pans while a modified scroll keeps pinch zoom', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, /^Actor, actor/u);
  await actor.click();
  const at = await emptyCanvasPoint(page);
  await page.mouse.move(at.x, at.y);
  const beforePan = await viewportTransform(page);

  await page.mouse.wheel(80, 50);

  await expect.poll(() => viewportTransform(page)).not.toBe(beforePan);
  const afterPan = await viewportTransform(page);
  expect(scaleOf(afterPan)).toBe(scaleOf(beforePan));
  await expect(actor).toHaveClass(/selected/u);

  await page.keyboard.down('Control');
  await page.mouse.wheel(0, 100);
  await page.keyboard.up('Control');

  await expect
    .poll(async () => scaleOf(await viewportTransform(page)))
    .not.toBe(scaleOf(afterPan));
});

test('a touch drag pans without becoming a selection click', async ({
  page,
}) => {
  const session = await touchSession(page);
  await openPlaceholder(page);
  const actor = nodeNamed(page, /^Actor, actor/u);
  await actor.click();
  const from = await emptyCanvasPoint(page);
  const before = await viewportTransform(page);

  await touchDrag(session, from, movedPoint(page, from));

  await expect.poll(() => viewportTransform(page)).not.toBe(before);
  await expect(actor).toHaveClass(/selected/u);
  await session.detach();
});

const notePlacements = ['click', 'drag', 'keyboard'] as const;

for (const placement of notePlacements) {
  test(`a ${placement} placement opens the new Note for typing`, async ({
    page,
  }) => {
    await openPlaceholder(page);
    const from = await emptyCanvasPoint(page);

    if (placement === 'keyboard') {
      await canvasSurface(page).focus();
      await page.keyboard.press(registeredChords['note-tool'][0]);
      await page.keyboard.press('Enter');
    } else {
      await toolButton(page, 'Note').click();
      if (placement === 'click') {
        await page.mouse.click(from.x, from.y);
      } else {
        const to = movedPoint(page, from);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 6 });
        await page.mouse.up();
      }
    }

    const editor = page.getByRole('textbox', { name: 'Note text' });
    await expect(editor).toBeFocused();
    await editor.fill('First line\nSecond line');
    await editor.press('Control+Enter');
    const note = nodeNamed(page, /^Note, text/u);
    const drawnText = async (): Promise<string> =>
      (await note.locator('text.pn-note tspan').allTextContents())
        .join('')
        .replace(/\s/gu, '');
    await expect.poll(drawnText).toBe('FirstlineSecondline');

    await page.keyboard.press(registeredChords.undo[0]);
    await expect.poll(drawnText).toBe('Newnote');
    await page.keyboard.press(registeredChords.undo[0]);
    await expect(note).toHaveCount(0);
  });
}
