import { noDivergence, renderDivergences } from '@panoptes/formats';
import { parseModel } from '@panoptes/model';
import { renderRegister } from '@panoptes/render';
import { Either } from 'effect';

describe('cli placeholder wiring', () => {
  it('reaches every workspace dependency', () => {
    const empty = parseModel({
      metadata: { title: '', owner: '', description: '', contributors: [] },
      diagrams: [],
      threats: [],
      lastIssuedThreatNumber: 0,
      mitigations: [],
      assumptions: [],
    });
    expect(renderDivergences(noDivergence)).toEqual('No divergence recorded.');
    expect(Either.map(empty, renderRegister)).toEqual(
      Either.right('# Threat register\n\nThis model records no threats.\n'),
    );
  });
});
