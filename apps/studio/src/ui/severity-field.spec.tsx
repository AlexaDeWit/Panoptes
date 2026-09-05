import { severitySchema, type Severity } from '@panoptes/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SeverityField } from './severity-field.js';

const noop = (): void => undefined;

describe('SeverityField', () => {
  it('names its trigger Severity, as a combobox', () => {
    render(<SeverityField onCommit={noop} value="high" />);

    expect(screen.getByRole('combobox', { name: 'Severity' })).toBeDefined();
  });

  it('offers every severity the model names and nothing else', async () => {
    const user = userEvent.setup();
    render(<SeverityField onCommit={noop} value="high" />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getAllByRole('option')).toHaveLength(
      severitySchema.options.length,
    );
    for (const severity of severitySchema.options) {
      expect(screen.getByRole('option', { name: severity })).toBeDefined();
    }
  });

  it('commits the severity chosen with the keyboard alone', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(severity: Severity) => void>();
    render(<SeverityField onCommit={onCommit} value="low" />);

    await user.tab();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');

    expect(onCommit).toHaveBeenCalledWith('medium');
  });
});
