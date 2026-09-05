import { replaceThreat, type Model, type Threat } from '@panoptes/model';
import { elementId, threatId } from '@panoptes/model/fixtures';
import { Either } from 'effect';
import { Action } from '../store/actions.js';
import { initialState, type State } from '../store/state.js';
import {
  actorElement,
  newProcess,
  processElement,
  sampleModel,
  sampleThreat,
} from '../store/store.fixtures.js';
import {
  attachedThreats,
  elementLabel,
  freshThreat,
  nextNumber,
  panelElement,
  threatAfterDeleting,
  threatCommitter,
} from './threats.js';

const selecting = (selection: State['selection']): State => ({
  ...initialState(sampleModel),
  selection,
});

const mitigated: Model = Either.getOrElse(
  replaceThreat(sampleModel, { ...sampleThreat, status: 'mitigated' }),
  () => sampleModel,
);

const second: Threat = { ...sampleThreat, id: threatId('threat-second') };

const third: Threat = { ...sampleThreat, id: threatId('threat-third') };

const recorder = () => vi.fn<(action: Action) => void>();

describe('panelElement', () => {
  it('is the element the canvas selected', () => {
    expect(panelElement(selecting(actorElement))?.name).toBe('Reader');
  });

  it('is nothing while nothing is selected', () => {
    expect(panelElement(selecting(undefined))).toBeUndefined();
  });

  it('is nothing where the selection names no element of the model', () => {
    expect(panelElement(selecting(elementId('element-gone')))).toBeUndefined();
  });
});

describe('attachedThreats', () => {
  it('lists the threats naming the selected element', () => {
    expect(attachedThreats(selecting(actorElement))).toEqual([sampleThreat]);
  });

  it('lists none for an element no threat names', () => {
    expect(attachedThreats(selecting(processElement))).toEqual([]);
  });

  it('lists none while nothing is selected', () => {
    expect(attachedThreats(selecting(undefined))).toEqual([]);
  });

  it('lists a threat whatever its status, where the badge counts the open ones', () => {
    const state = { ...initialState(mitigated), selection: actorElement };

    expect(attachedThreats(state)).toHaveLength(1);
  });
});

describe('elementLabel', () => {
  it('is what the element is called', () => {
    expect(elementLabel(newProcess('process-named', 'Studio'))).toBe('Studio');
  });

  it('is what kind of element it is where it is called nothing', () => {
    expect(elementLabel(newProcess('process-unnamed', ''))).toBe('the process');
  });
});

describe('nextNumber', () => {
  it('is the number the model issues next', () => {
    expect(nextNumber(initialState(sampleModel))).toBe(2);
  });
});

describe('freshThreat', () => {
  it('opens attached to the element, unassessed and undispositioned', () => {
    const threat = freshThreat(7, actorElement);

    expect(threat.number).toBe(7);
    expect(threat.elements).toEqual([actorElement]);
    expect(threat.severity).toBe('undecided');
    expect(threat.status).toBe('open');
  });

  it('takes an id of its own on every add', () => {
    expect(freshThreat(7, actorElement).id).not.toBe(
      freshThreat(8, actorElement).id,
    );
  });
});

describe('threatAfterDeleting', () => {
  it('is the threat that takes the deleted one place in the list', () => {
    expect(threatAfterDeleting([sampleThreat, second, third], second.id)).toBe(
      third.id,
    );
  });

  it('is the threat before it where the deleted one was last', () => {
    expect(threatAfterDeleting([sampleThreat, second], second.id)).toBe(
      sampleThreat.id,
    );
  });

  it('is nothing where the deleted threat was the only one', () => {
    expect(
      threatAfterDeleting([sampleThreat], sampleThreat.id),
    ).toBeUndefined();
  });

  it('is nothing for a threat the list never held', () => {
    expect(threatAfterDeleting([sampleThreat], second.id)).toBeUndefined();
  });
});

describe('threatCommitter', () => {
  it('dispatches nothing while the panel is on no threat', () => {
    const send = recorder();

    threatCommitter(send, undefined)({ severity: 'high' });

    expect(send).toHaveBeenCalledTimes(0);
  });

  it('dispatches nothing for a patch that leaves every field as it was', () => {
    const send = recorder();

    threatCommitter(send, sampleThreat)({ severity: sampleThreat.severity });

    expect(send).toHaveBeenCalledTimes(0);
  });

  it('dispatches one replacement carrying the patch and nothing else', () => {
    const send = recorder();

    threatCommitter(send, sampleThreat)({ severity: 'critical' });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      Action.ReplaceThreat({
        threat: { ...sampleThreat, severity: 'critical' },
      }),
    );
  });
});
