import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Severity, severitySchema } from '@panoptes/model';

import { SeverityField, severityCommitter } from './severity-field.js';

const noop = (): void => undefined;

describe('severityCommitter', () => {
  it('commits a value the model names', () => {
    const onCommit = vi.fn<(severity: Severity) => void>();

    severityCommitter(onCommit)('critical');

    expect(onCommit).toHaveBeenCalledWith('critical');
  });

  it('commits nothing for a value the model does not name', () => {
    const onCommit = vi.fn<(severity: Severity) => void>();

    severityCommitter(onCommit)('catastrophic');

    expect(onCommit).toHaveBeenCalledTimes(0);
  });
});

describe('SeverityField', () => {
  it('names the trigger from its visible label, as a combobox', () => {
    render(<SeverityField onCommit={noop} value="high" />);

    expect(screen.getByRole('combobox', { name: 'Severity' })).toBeDefined();
  });

  it('puts the trigger on the tab path', async () => {
    const user = userEvent.setup();
    render(<SeverityField onCommit={noop} value="high" />);

    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole('combobox'));
  });

  it('offers every model severity as an option named by its text', async () => {
    const user = userEvent.setup();
    render(<SeverityField onCommit={noop} value="high" />);

    await user.tab();
    await user.keyboard('{Enter}');

    for (const severity of severitySchema.options) {
      expect(screen.getByRole('option', { name: severity })).toBeDefined();
    }
  });

  it('commits the severity chosen with the keyboard alone', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(severity: Severity) => void>();
    render(<SeverityField onCommit={onCommit} value="low" />);

    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('medium');
  });

  it('commits nothing when the listbox is dismissed', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(severity: Severity) => void>();
    render(<SeverityField onCommit={onCommit} value="low" />);

    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{Escape}');

    expect(onCommit).toHaveBeenCalledTimes(0);
  });

  it('commits nothing when the value already set is chosen again', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(severity: Severity) => void>();
    render(<SeverityField onCommit={onCommit} value="low" />);

    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(0);
  });
});
