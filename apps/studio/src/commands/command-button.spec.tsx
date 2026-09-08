import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { currentTool, resetTools } from '../canvas/tools.js';
import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { CommandSurfaceProvider } from './binding.js';
import { CommandButton, IconCommandButton } from './command-button.js';
import { recordingSurface } from './commands.fixtures.js';

describe('CommandButton', () => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
    resetTools();
  });

  it('takes its words from the registry, and gives way to a caller that says more', () => {
    render(
      <>
        <CommandButton command="save" />
        <CommandButton command="save-as">
          Save as Saerskriven YAML
        </CommandButton>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Save as Saerskriven YAML' }),
    ).toBeDefined();
  });

  it('shows the shortcut as a tooltip, as the ARIA binding, and as the description', () => {
    render(<CommandButton command="redo" />);
    const control = screen.getByRole('button', { name: 'Redo' });

    expect(control.getAttribute('title')).toBe('Ctrl+Shift+Z or Ctrl+Y');
    expect(control.getAttribute('aria-keyshortcuts')).toBe(
      'Control+Shift+Z Control+Y',
    );
    const description = control.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(description)?.textContent).toContain(
      control.getAttribute('title'),
    );
  });

  it('keeps the shortcut out of the name, so a control is found by what it says', () => {
    render(<CommandButton command="save" />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
  });

  it('runs the command against the surface it is mounted under', async () => {
    const user = userEvent.setup();
    const recording = recordingSurface();
    render(
      <CommandSurfaceProvider surface={recording.surface}>
        <CommandButton command="open" />
      </CommandSurfaceProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(recording.asked).toEqual(['open']);
  });

  it('runs a toolbox command with no surface mounted at all', async () => {
    const user = userEvent.setup();
    render(<CommandButton command="actor-tool">New actor</CommandButton>);

    await user.click(screen.getByRole('button', { name: 'New actor' }));

    expect(currentTool().active).toBe('actor');
  });
});

describe('IconCommandButton', () => {
  it('takes its accessible name from the registry, the glyph carrying none', () => {
    render(
      <IconCommandButton command="zoom-in">
        <svg aria-hidden="true" />
      </IconCommandButton>,
    );

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDefined();
  });

  it('says the command and its chord in a tooltip, on focus as well as on hover', async () => {
    render(
      <IconCommandButton command="fit-to-view">
        <svg aria-hidden="true" />
      </IconCommandButton>,
    );

    act(() => {
      screen.getByRole('button', { name: 'Fit to view' }).focus();
    });

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Fit to view');
    expect(tooltip.textContent).toContain('Ctrl+0');
  });

  it('runs the command against the surface it is mounted under', async () => {
    const user = userEvent.setup();
    const recording = recordingSurface();
    render(
      <CommandSurfaceProvider surface={recording.surface}>
        <IconCommandButton command="zoom-out">
          <svg aria-hidden="true" />
        </IconCommandButton>
      </CommandSurfaceProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Zoom out' }));

    expect(recording.asked).toEqual(['zoomOut']);
  });

  it('reports whether a tool mode is active', () => {
    render(
      <IconCommandButton command="actor-tool" pressed>
        <svg aria-hidden="true" />
      </IconCommandButton>,
    );

    expect(
      screen
        .getByRole('button', { name: 'Actor' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });
});
