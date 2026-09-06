import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandSurfaceProvider } from '../commands/binding.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { ZoomCluster } from './zoom-cluster.js';

const control = (name: string): HTMLElement =>
  screen.getByRole('button', { name });

describe('ZoomCluster', () => {
  it('names each icon after the command it runs, and says which chord runs it', () => {
    render(<ZoomCluster />);

    expect(control('Zoom in').getAttribute('aria-keyshortcuts')).toBe(
      'Control+=',
    );
    expect(control('Zoom out').getAttribute('aria-keyshortcuts')).toBe(
      'Control+-',
    );
    expect(control('Fit to view').getAttribute('aria-keyshortcuts')).toBe(
      'Control+0',
    );
  });

  it('runs each viewport command against the surface it is mounted under', async () => {
    const user = userEvent.setup();
    const recording = recordingSurface();
    render(
      <CommandSurfaceProvider surface={recording.surface}>
        <ZoomCluster />
      </CommandSurfaceProvider>,
    );

    await user.click(control('Zoom in'));
    await user.click(control('Zoom out'));
    await user.click(control('Fit to view'));

    expect(recording.asked).toEqual(['zoomIn', 'zoomOut', 'fitToView']);
  });
});
