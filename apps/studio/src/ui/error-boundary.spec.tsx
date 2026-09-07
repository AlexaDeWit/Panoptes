import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './error-boundary.js';

const failure = 'failure';

function Breaks(): never {
  throw new Error(failure);
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
        <p data-testid="child" />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('shows what was thrown rather than an empty page', () => {
    render(
      <ErrorBoundary>
        <Breaks />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('region').textContent).toContain(failure);
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
