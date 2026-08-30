import { emptyLossReport, renderLossReport } from '@panoptes/formats';
import { render } from '@panoptes/render';

describe('cli placeholder wiring', () => {
  it('reaches both workspace dependencies', () => {
    expect(renderLossReport(emptyLossReport)).toEqual('No loss recorded.');
    expect(render()).toEqual('render of model');
  });
});
