import { threatStatusSchema, type ThreatStatus } from '@panoptes/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StatusField } from './status-field.js';

const noop = (): void => undefined;

describe('StatusField', () => {
  it('names its trigger Status, as a combobox', () => {
    render(<StatusField onCommit={noop} value="open" />);

    expect(screen.getByRole('combobox', { name: 'Status' })).toBeDefined();
  });

  it('offers every status the model names and nothing else', async () => {
    const user = userEvent.setup();
    render(<StatusField onCommit={noop} value="open" />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getAllByRole('option')).toHaveLength(
      threatStatusSchema.options.length,
    );
    for (const status of threatStatusSchema.options) {
      expect(screen.getByRole('option', { name: status })).toBeDefined();
    }
  });

  it('commits the status chosen with the keyboard alone', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(status: ThreatStatus) => void>();
    render(<StatusField onCommit={onCommit} value="open" />);

    await user.tab();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');

    expect(onCommit).toHaveBeenCalledWith('mitigated');
  });
});
