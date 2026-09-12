import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readAnyFormat } from '@saerskriven/formats';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import {
  drawnBy,
  halfwayAlong,
  lineOf,
  pressOn,
  turnsOf,
} from './canvas-geometry.fixtures.js';
import {
  canvasSettled,
  exportedFile,
  nodeNamed,
  openFile,
  openPlaceholder,
  openText,
  savedFile,
  selectByKeyboard,
  vendored,
} from './studio.fixtures.js';

const records = /^Records, flow/u;
const mirrored = /^publish mirrored artifact \(minted write token\), flow/u;
const recoveryKey = 'saerskriven:studio:recovery';

test('Shift-click still deselects a flow through its line hit target', async ({
  page,
}) => {
  await openPlaceholder(page);
  const flow = await selectByKeyboard(page, records);
  const at = await halfwayAlong(lineOf(page, records));
  const recovery = await page.evaluate(
    (key) => localStorage.getItem(key),
    recoveryKey,
  );
  await page.keyboard.down('Shift');
  await page.mouse.click(at.x, at.y);
  await page.keyboard.up('Shift');
  await expect(flow).not.toHaveClass(/selected/u);
  await expect(
    page.getByRole('button', { name: 'Add bend', exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), recoveryKey),
  ).toBe(recovery);
});

test('clicking a preview bend confirms its insertion', async ({ page }) => {
  await openPlaceholder(page);
  await selectByKeyboard(page, records);
  await page.keyboard.press('+');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.getByRole('button', { name: 'Bend 1', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Remove bend', exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('[data-bend-index]')).toHaveCount(0);
});

test('keyboard insertion chooses a segment, previews, cancels, and commits one undo step', async ({
  page,
}) => {
  await openPlaceholder(page);
  const flow = await selectByKeyboard(page, records);
  const line = lineOf(page, records);
  const original = await drawnBy(line);
  const recovery = await page.evaluate(
    (key) => localStorage.getItem(key),
    recoveryKey,
  );
  await page.keyboard.press('+');
  await expect(page.locator('[data-chosen="true"]')).toHaveAttribute(
    'data-bend-segment',
    '0',
  );
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(
    page.getByRole('button', { name: 'Bend 1', exact: true }),
  ).toBeVisible();
  expect(turnsOf(await drawnBy(line))[1].y).toBe(turnsOf(original)[0].y + 20);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), recoveryKey),
  ).toBe(recovery);
  await page.keyboard.press('Escape');
  await expect(line).toHaveAttribute('d', original);
  await expect(flow).toBeFocused();
  await page.keyboard.press('+');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const oneBend = await drawnBy(line);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(line).toHaveAttribute('d', original);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(line).toHaveAttribute('d', oneBend);
  await page.keyboard.press('+');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-chosen="true"]')).toHaveAttribute(
    'data-bend-segment',
    '1',
  );
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-bend-index]')).toHaveCount(2);
  expect(turnsOf(await drawnBy(line))[1]).toEqual(turnsOf(oneBend)[1]);
  const second = page.getByRole('button', { name: 'Bend 2', exact: true });
  await second.focus();
  const before = turnsOf(await drawnBy(line))[2];
  await page.keyboard.press('Shift+ArrowRight');
  expect(turnsOf(await drawnBy(line))[2]).toEqual({
    x: before.x + 20,
    y: before.y,
  });
  await page.keyboard.press('Delete');
  await expect(page.locator('[data-bend-index]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Bend 1', exact: true }).focus();
  await page.keyboard.press('Backspace');
  await expect(line).toHaveAttribute('d', original);
  await expect(flow).toBeFocused();
});

test('pulling the line and its bends previews after zoom and pan, with cancellation', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectByKeyboard(page, records);
  await page.keyboard.press('ControlOrMeta+-');
  await canvasSettled(page);
  await page.mouse.move(550, 240);
  await page.mouse.wheel(65, 40);
  await canvasSettled(page);
  const line = lineOf(page, records);
  const original = await drawnBy(line);
  const at = await halfwayAlong(line);
  const recovery = await page.evaluate(
    (key) => localStorage.getItem(key),
    recoveryKey,
  );
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 30, at.y + 65, { steps: 5 });
  await expect.poll(() => drawnBy(line)).not.toBe(original);
  const preview = await drawnBy(line);
  expect(turnsOf(preview)).toHaveLength(3);
  const drawnBend = await page
    .getByRole('button', { name: 'Bend 1', exact: true })
    .boundingBox();
  expect(drawnBend).not.toBeNull();
  expect((drawnBend?.x ?? 0) + (drawnBend?.width ?? 0) / 2).toBeCloseTo(
    at.x + 30,
    0,
  );
  expect((drawnBend?.y ?? 0) + (drawnBend?.height ?? 0) / 2).toBeCloseTo(
    at.y + 65,
    0,
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), recoveryKey),
  ).toBe(recovery);
  await page.mouse.up();
  await expect(line).toHaveAttribute('d', preview);
  const bend = page.getByRole('button', { name: 'Bend 1', exact: true });
  const start = await pressOn(page, bend);
  await page.mouse.move(start.x - 35, start.y + 30, { steps: 5 });
  await expect.poll(() => drawnBy(line)).not.toBe(preview);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(line).toHaveAttribute('d', preview);
  const again = await pressOn(page, bend);
  await page.mouse.move(again.x + 25, again.y - 15, { steps: 5 });
  const moved = await drawnBy(line);
  await page.mouse.up();
  await expect(line).toHaveAttribute('d', moved);
  await expect(page.locator('[data-bend-index]')).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(line).toHaveAttribute('d', preview);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(line).toHaveAttribute('d', original);
});

test('click-only insertion, movement, and removal keep the flow and expose accessible controls', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectByKeyboard(page, records);
  const line = lineOf(page, records);
  const original = await drawnBy(line);
  const at = await halfwayAlong(line);
  await page.getByRole('button', { name: 'Add bend', exact: true }).click();
  await page.mouse.click(at.x, at.y);
  await page.mouse.click(at.x + 30, at.y + 80);
  const inserted = await drawnBy(line);
  expect(turnsOf(inserted)).toHaveLength(3);
  await page.getByRole('button', { name: 'Bend 1', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Remove bend', exact: true }),
  ).toBeFocused();
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations).toEqual([]);
  await page.getByRole('button', { name: 'Move bend', exact: true }).click();
  await page.mouse.click(at.x + 50, at.y + 100);
  expect(await drawnBy(line)).not.toBe(inserted);
  await page.getByRole('button', { name: 'Bend 1', exact: true }).click();
  await page.getByRole('button', { name: 'Remove bend', exact: true }).click();
  await expect(line).toHaveAttribute('d', original);
  await expect(nodeNamed(page, records)).toBeFocused();
});

test('a selected flow still renames and a cancelled or returned drag creates no edit', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectByKeyboard(page, records);
  const line = lineOf(page, records);
  const original = await drawnBy(line);
  const at = await halfwayAlong(line);
  const recovery = await page.evaluate(
    (key) => localStorage.getItem(key),
    recoveryKey,
  );
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x, at.y + 50, { steps: 4 });
  await page.mouse.move(at.x, at.y, { steps: 4 });
  await page.mouse.up();
  await expect(line).toHaveAttribute('d', original);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), recoveryKey),
  ).toBe(recovery);
  await page.mouse.dblclick(at.x, at.y);
  const name = page.getByRole('textbox', {
    name: 'Name of Records',
    exact: true,
  });
  await expect(name).toBeFocused();
  await name.fill('Records + metadata');
  await name.press('Enter');
  await expect(nodeNamed(page, /^Records \+ metadata, flow/u)).toBeVisible();
  await expect(page.locator('[data-bend-index]')).toHaveCount(0);
});

for (const fixture of [
  'test-data/ecluse.json',
  'test-data/saerskriven/ecluse.yaml',
]) {
  test(`route edits preserve metadata and survive save/reopen in ${fixture}`, async ({
    page,
  }) => {
    const before = Either.getOrThrow(
      readAnyFormat(readFileSync(vendored(fixture), 'utf8')),
    ).model;
    await openFile(page, fixture);
    await selectByKeyboard(page, mirrored);
    const line = lineOf(page, mirrored);
    await page.getByRole('button', { name: 'Bend 1', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('+');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Enter');
    const points = turnsOf(await drawnBy(line)).slice(1, -1);
    const written = await savedFile(page);
    const after = Either.getOrThrow(readAnyFormat(written.text)).model;
    const expected = {
      ...before,
      diagrams: before.diagrams.map((diagram) => ({
        ...diagram,
        elements: diagram.elements.map((element) =>
          element.id === '0ec10e5e-0000-4000-8000-00000000004a'
            ? { ...element, waypoints: points }
            : element,
        ),
      })),
    };
    expect(after).toEqual(expected);
    await openText(page, written.name, written.text);
    await canvasSettled(page);
    await selectByKeyboard(page, mirrored);
    expect(turnsOf(await drawnBy(line)).slice(1, -1)).toEqual(points);
    const output = await exportedFile(page, 'Diagram as SVG');
    const svg = output.bytes.toString('utf8');
    expect(svg).toContain(await drawnBy(line));
    expect(svg).not.toContain('data-bend-index');
  });
}
