import type { ElementId } from '@panoptes/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { resetAnnouncements } from './announcements.js';
import {
  boundaryElement,
  canvasModel,
  noteElement,
  readerElement,
  requestFlow,
} from './canvas.fixtures.js';
import { paletteKinds, paletteNames } from './elements.js';
import { EditPalette } from './palette.js';

const opened = (selection?: ElementId): void => {
  modelStore.setState({ ...initialState(canvasModel), selection }, true);
  resetAnnouncements();
};

const elementCount = (): number =>
  modelStore.getState().present.diagrams[0].elements.length;

const announced = (): string =>
  screen.getByTestId('canvas-announcement').textContent ?? '';

describe('EditPalette', () => {
  beforeEach(() => {
    opened();
  });

  it('offers one button per element kind the canvas draws', () => {
    render(<EditPalette />);

    for (const kind of paletteKinds) {
      expect(
        screen.getByRole('button', { name: paletteNames[kind] }),
      ).toBeDefined();
    }
  });

  it('adds an element through the store and says what it added', async () => {
    const user = userEvent.setup();
    render(<EditPalette />);

    await user.click(screen.getByRole('button', { name: 'New store' }));

    expect(elementCount()).toBe(7);
    expect(announced()).toBe('Added New store, store.');
  });

  it('keeps the region in the page while it has nothing to say', () => {
    render(<EditPalette />);

    expect(announced()).toBe('');
  });

  it('leaves connecting unavailable while no element is selected', () => {
    render(<EditPalette />);

    expect(
      screen.getByRole('button', { name: 'Connect' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('combobox', { name: 'Flow to' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('leaves connecting unavailable while the selection is a flow', () => {
    opened(requestFlow);
    render(<EditPalette />);

    expect(
      screen.getByRole('button', { name: 'Connect' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('combobox', { name: 'Flow to' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('leaves connecting unavailable while the selection is a trust boundary', () => {
    opened(boundaryElement);
    render(<EditPalette />);

    expect(
      screen.getByRole('button', { name: 'Connect' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('combobox', { name: 'Flow to' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('leaves connecting unavailable while the selection is a text note', () => {
    opened(noteElement);
    render(<EditPalette />);

    expect(
      screen.getByRole('button', { name: 'Connect' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('combobox', { name: 'Flow to' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('offers neither a trust boundary nor a note as the end of a flow', async () => {
    const user = userEvent.setup();
    opened(readerElement);
    render(<EditPalette />);

    await user.click(screen.getByRole('combobox', { name: 'Flow to' }));

    expect(screen.queryByRole('option', { name: 'Perimeter' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Note' })).toBeNull();
  });

  it('draws a flow to the element chosen with the keyboard alone', async () => {
    const user = userEvent.setup();
    opened(readerElement);
    render(<EditPalette />);

    await user.click(screen.getByRole('combobox', { name: 'Flow to' }));
    await user.click(screen.getByRole('option', { name: 'Studio' }));
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(elementCount()).toBe(7);
    expect(announced()).toBe('Added New flow, flow, from Reader to Studio.');
  });

  it('offers every element but the one a flow would start at', async () => {
    const user = userEvent.setup();
    opened(readerElement);
    render(<EditPalette />);

    await user.click(screen.getByRole('combobox', { name: 'Flow to' }));

    expect(screen.getByRole('option', { name: 'Studio' })).toBeDefined();
    expect(screen.queryByRole('option', { name: 'Reader' })).toBeNull();
  });
});
