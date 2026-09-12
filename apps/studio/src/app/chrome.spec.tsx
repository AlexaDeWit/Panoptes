import { act, render, screen } from '@testing-library/react';
import { useMemo } from 'react';
import {
  CommandSurfaceProvider,
  unmountedSurface,
} from '../commands/binding.js';
import { announce, resetAnnouncements } from '../canvas/announcements.js';
import { resetConnecting } from '../canvas/connecting.js';
import { resetTools } from '../canvas/tools.js';
import { useFileSession } from '../files/file-commands.js';
import { specBridge } from '../files/files.fixtures.js';
import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { StudioChrome } from './chrome.js';

const cardHeight = '--pn-chrome-block-size';

function Chrome() {
  const session = useFileSession(specBridge());
  const surface = useMemo(
    () => ({ ...unmountedSurface, files: session.commands }),
    [session.commands],
  );

  return (
    <CommandSurfaceProvider surface={surface}>
      <StudioChrome session={session} />
    </CommandSurfaceProvider>
  );
}

const card = (): HTMLElement => screen.getByTestId('chrome-card');

describe('StudioChrome', () => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
    resetAnnouncements();
    resetConnecting();
    resetTools();
  });

  it('holds the menu, the diagram control and every tool in one card', () => {
    render(<Chrome />);
    const held = card();

    expect(held.contains(screen.getByRole('button', { name: /^Menu/u }))).toBe(
      true,
    );
    expect(held.contains(screen.getByTestId('diagram-switcher'))).toBe(true);
    expect(held.contains(screen.getByTestId('toolbox'))).toBe(true);
    for (const name of ['Select', 'Actor', 'Hand']) {
      expect(held.contains(screen.getByRole('button', { name }))).toBe(true);
    }
  });

  it('hangs the reports and the canvas announcement under the card', () => {
    render(<Chrome />);
    const held = card();

    for (const testId of [
      'failure-notice',
      'loss-report',
      'canvas-announcement',
    ]) {
      const region = screen.getByTestId(testId);
      expect(held.contains(region)).toBe(false);
      expect(
        held.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('says what an edit did without moving the region into the card', () => {
    render(<Chrome />);

    act(() => {
      announce('An edit completed.');
    });

    expect(screen.getByTestId('canvas-announcement').textContent).toContain(
      'completed',
    );
  });

  it('measures the card height back onto the document root', () => {
    const view = render(<Chrome />);
    expect(document.documentElement.style.getPropertyValue(cardHeight)).toMatch(
      /px$/u,
    );

    view.unmount();

    expect(document.documentElement.style.getPropertyValue(cardHeight)).toBe(
      '',
    );
  });
});
