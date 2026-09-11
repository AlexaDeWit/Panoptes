import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetTools } from '../canvas/tools.js';
import { elementCount } from '../store/selectors.js';
import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { appTimeout } from './app.fixtures.js';
import { App } from './app.js';

const build = vi.hoisted(() => ({ version: '1.2.3', tag: '' }));
vi.mock('../version.js', () => ({
  get studioVersion() {
    return build.version;
  },
  get studioReleaseTag() {
    return build.tag;
  },
  studioBuildId: 'spec',
}));

const elementsHeld = (): number => elementCount(modelStore.getState());

const processTool = (): HTMLElement =>
  screen.getByRole('button', { name: 'Process' });

const undoThroughMenu = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: /^Menu/u }));
  await user.click(await screen.findByRole('menuitem', { name: 'Undo' }));
};

describe(
  'App',
  () => {
    beforeEach(() => {
      build.version = '1.2.3';
      build.tag = '';
      modelStore.setState(initialState(placeholderModel), true);
      resetTools();
    });

    it('renders the canvas', () => {
      render(<App />);
      expect(screen.getByTestId('canvas-container')).toBeTruthy();
    });

    it.each(['1.2.3', '1.2.3-beta.1'])(
      'shows release %s outside the menu without another link',
      (version) => {
        build.version = version;
        build.tag = `v${version}`;
        render(<App />);
        const badge = screen.getByTestId('studio-version');
        expect(badge.textContent).toBe(version);
        expect(badge.closest('a')).toBeNull();
        expect(screen.queryByRole('menu')).toBeNull();
      },
    );

    it('identifies development builds in the version badge', () => {
      render(<App />);
      expect(screen.getByTestId('studio-version').textContent).toBe(
        `${build.version} (development)`,
      );
    });

    it('draws no threat panel while nothing is selected', () => {
      render(<App />);
      expect(screen.queryByRole('region', { name: 'Threats' })).toBeNull();
    });

    it('names the page for a reader without drawing a title bar over the canvas', () => {
      render(<App />);
      expect(
        screen.getByRole('heading', { level: 1 }).textContent?.trim(),
      ).not.toBe('');
    });

    it('shows an edit placed with the toolbox and takes it back through the menu', async () => {
      const user = userEvent.setup();
      render(<App />);
      expect(elementsHeld()).toBe(3);

      await user.click(processTool());
      const canvas = screen.getByTestId('rf__wrapper');
      fireEvent.pointerDown(canvas, {
        button: 0,
        clientX: 100,
        clientY: 100,
        isPrimary: true,
        pointerId: 1,
      });
      fireEvent.pointerUp(canvas, {
        button: 0,
        clientX: 100,
        clientY: 100,
        isPrimary: false,
        pointerId: 2,
      });
      expect(elementsHeld()).toBe(3);
      fireEvent.pointerUp(canvas, {
        button: 0,
        clientX: 100,
        clientY: 100,
        isPrimary: true,
        pointerId: 1,
      });
      expect(elementsHeld()).toBe(4);

      await undoThroughMenu(user);
      expect(elementsHeld()).toBe(3);
    });
  },
  appTimeout,
);
