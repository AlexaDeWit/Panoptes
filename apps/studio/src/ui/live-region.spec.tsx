import { render, screen } from '@testing-library/react';

import { LiveRegion } from './live-region.js';

describe('LiveRegion', () => {
  it('holds a region in the page while it has nothing to say', () => {
    render(<LiveRegion label="Threat changes" testId="changes" />);

    expect(screen.getByTestId('changes').textContent).toBe('');
  });

  it('announces politely, under the name its caller gave it', () => {
    render(
      <LiveRegion label="Threat changes" testId="changes">
        <p data-testid="message">A message</p>
      </LiveRegion>,
    );
    const region = screen.getByRole('region', { name: 'Threat changes' });

    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.contains(screen.getByTestId('message'))).toBe(true);
  });
});
