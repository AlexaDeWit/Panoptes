import { render } from '@testing-library/react';

import PanoptesCanvas from './canvas';

describe('PanoptesCanvas', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<PanoptesCanvas />);
    expect(baseElement).toBeTruthy();
  });
});
