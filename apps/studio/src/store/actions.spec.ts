import { Action } from './actions.js';
import { firstThreat, processElement } from './fixtures.js';

describe('Action', () => {
  it('carries an operation and its arguments under one tag', () => {
    const action = Action.AttachThreat({
      threatId: firstThreat,
      elementId: processElement,
    });
    expect(action._tag).toBe('AttachThreat');
    expect(action.threatId).toBe(firstThreat);
    expect(action.elementId).toBe(processElement);
  });

  it('bounds the union to the tags it declares', () => {
    // @ts-expect-error a tag the union does not declare is no action of the studio
    const foreign: Action = { _tag: 'RotateElement' };
    expect(foreign._tag).toBe('RotateElement');
  });
});
