import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './error-boundary.js';

function Breaks(): never {
  throw new Error('The canvas ran out of room.');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('shows what it guards while nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>The studio</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('The studio')).toBeDefined();
  });

  it('shows what was thrown rather than an empty page', () => {
    render(
      <ErrorBoundary>
        <Breaks />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Panoptes stopped')).toBeDefined();
    expect(screen.getByText('The canvas ran out of room.')).toBeDefined();
  });

  it('offers the reload that starts again from the file on disk', async () => {
    const user = userEvent.setup();
    const reload = vi.fn<() => void>();
    render(
      <ErrorBoundary reload={reload}>
        <Breaks />
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole('button', { name: 'Reload the studio' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
