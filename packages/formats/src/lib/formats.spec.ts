import { formats } from './formats.js';

describe('formats', () => {
  it('reaches the model package', () => {
    expect(formats()).toEqual('formats of model');
  });
});
