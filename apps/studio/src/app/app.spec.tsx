import { render } from '@testing-library/react';

import App from './app';

describe('App', () => {
  it('renders the canvas', () => {
    const { getAllByText } = render(<App />);
    expect(getAllByText('model').length > 0).toBeTruthy();
  });
});
