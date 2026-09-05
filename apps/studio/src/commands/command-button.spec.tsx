import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { CommandSurfaceProvider } from './binding.js';
import { CommandButton } from './command-button.js';
import { recordingSurface } from './commands.fixtures.js';

describe('CommandButton', () => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
  });

  it('takes its words from the registry, and gives way to a caller that says more', () => {
    render(
      <>
        <CommandButton command="save" />
        <CommandButton command="save-as">Save as Panoptes YAML</CommandButton>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Save as Panoptes YAML' }),
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
    expect(document.getElementById(description)?.textContent).toBe(
      'Shortcut: Ctrl+Shift+Z or Ctrl+Y',
    );
  });

  it('keeps the shortcut out of the name, so a control is found by what it says', () => {
    render(<CommandButton command="save" />);

    expect(screen.getByRole('button', { name: 'Save' }).textContent).toBe(
      'Save',
    );
  });

  it('runs the command against the surface it is mounted under', async () => {
    const user = userEvent.setup();
    const recording = recordingSurface();
    render(
      <CommandSurfaceProvider surface={recording.surface}>
        <CommandButton command="open" />
      </CommandSurfaceProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open a model' }));

    expect(recording.asked).toEqual(['open']);
  });

  it('runs a command the store answers for with no surface mounted at all', async () => {
    const user = userEvent.setup();
    render(<CommandButton command="actor-tool">New actor</CommandButton>);

    await user.click(screen.getByRole('button', { name: 'New actor' }));

    expect(modelStore.getState().present.diagrams[0].elements).toHaveLength(3);
  });
});
