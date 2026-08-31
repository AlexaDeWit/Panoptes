import { noDivergence, renderDivergences } from '@panoptes/formats';
import { render } from '@panoptes/render';

describe('cli placeholder wiring', () => {
  it('reaches both workspace dependencies', () => {
    expect(renderDivergences(noDivergence)).toEqual('No divergence recorded.');
    expect(render()).toEqual('render of model');
  });
});
