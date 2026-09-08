import { ReactFlowProvider } from '@xyflow/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandSurfaceProvider } from '../commands/binding.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { ZoomCluster } from './zoom-cluster.js';

const control = (name: string): HTMLElement =>
  screen.getByRole('button', { name });

describe('ZoomCluster', () => {
  it('names each icon after the command it runs, and says which chord runs it', () => {
    render(
      <ReactFlowProvider>
        <ZoomCluster />
      </ReactFlowProvider>,
    );

    expect(control('Zoom in').getAttribute('aria-keyshortcuts')).toBe(
      'Control+= Control+Plus',
    );
    expect(control('Zoom out').getAttribute('aria-keyshortcuts')).toBe(
      'Control+-',
    );
    expect(
      control('Reset zoom to 100%').getAttribute('aria-describedby'),
    ).toBeTruthy();
    expect(control('Fit to view').getAttribute('aria-keyshortcuts')).toBe(
      'Control+0',
    );
  });

  it('runs each viewport command against the surface it is mounted under', async () => {
    const user = userEvent.setup();
    const recording = recordingSurface();
    render(
      <ReactFlowProvider>
        <CommandSurfaceProvider surface={recording.surface}>
          <ZoomCluster />
        </CommandSurfaceProvider>
      </ReactFlowProvider>,
    );

    await user.click(control('Zoom in'));
    await user.click(control('Zoom out'));
    await user.click(control('Fit to view'));
    await user.click(control('Fit selection'));
    await user.click(control('Reset zoom to 100%'));

    expect(recording.asked).toEqual([
      'zoomIn',
      'zoomOut',
      'fitToView',
      'fitSelection',
      'resetZoom',
    ]);
  });
});
