import { render } from './render.js';

describe('render', () => {
  it('reaches the model package', () => {
    expect(render()).toEqual('render of model');
  });
});
