import { formats } from '@panoptes/formats';
import { render } from '@panoptes/render';

describe('cli placeholder wiring', () => {
  it('reaches both workspace dependencies', () => {
    expect(formats()).toEqual('formats of model');
    expect(render()).toEqual('render of model');
  });
});
