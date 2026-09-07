import { elementId } from '@saerskriven/model/fixtures';
import { renderUnplacedWarning } from './unplaced-warning.js';

describe('renderUnplacedWarning', () => {
  it('writes the endpoint lines used by every projection caller', () => {
    expect(
      renderUnplacedWarning([
        {
          flow: elementId('flow-2'),
          side: 'target',
          element: elementId('flow-1'),
        },
      ]),
    ).toBe(
      'warning: a flow endpoint names an element the canvas draws as no box, so its flow is not in the drawing.\n' +
        '  flow "flow-2" target names "flow-1"\n',
    );
  });

  it('writes nothing when the projection placed every endpoint', () => {
    expect(renderUnplacedWarning([])).toBe('');
  });
});
