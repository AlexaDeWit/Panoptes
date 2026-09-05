import { emptyModel, type ElementId } from '@panoptes/model';
import { elementId } from '@panoptes/model/fixtures';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';
import {
  boundaryElement,
  canvasModel,
  probeFlow,
  readerElement,
  requestFlow,
  studioElement,
} from './canvas.fixtures.js';
import {
  addPaletteElement,
  connectElements,
  describeRemoval,
  removalCascade,
  removeSelected,
} from './edits.js';

const opened = (selection?: ElementId): void => {
  modelStore.setState({ ...initialState(canvasModel), selection }, true);
  resetAnnouncements();
};

const said = (): string => currentAnnouncement().message;

const emptied = (): void => {
  modelStore.setState(initialState(emptyModel), true);
  resetAnnouncements();
};

describe('removalCascade', () => {
  it('counts the flows an element holds and the threats that name it', () => {
    expect(removalCascade(canvasModel, readerElement)).toEqual({
      flows: 1,
      threats: 1,
    });
  });

  it('counts nothing for a flow, which no other element holds', () => {
    expect(removalCascade(canvasModel, probeFlow)).toEqual({
      flows: 0,
      threats: 0,
    });
  });
});

describe('describeRemoval', () => {
  it('says what went and what the model changed around it', () => {
    expect(describeRemoval('Reader, actor', { flows: 2, threats: 1 })).toBe(
      'Removed Reader, actor. 2 flows detached, 1 threat link dropped.',
    );
  });

  it('says a count of none rather than leaving it out', () => {
    expect(describeRemoval('Reader, actor', { flows: 0, threats: 0 })).toBe(
      'Removed Reader, actor. no flows detached, no threat links dropped.',
    );
  });
});

describe('addPaletteElement', () => {
  beforeEach(() => {
    opened();
  });

  it('adds the element, selects it, and says so', () => {
    addPaletteElement('actor');

    const state = modelStore.getState();
    expect(state.present.diagrams[0].elements).toHaveLength(7);
    expect(state.selection).toBeDefined();
    expect(said()).toBe('Added New actor, actor.');
  });

  it('costs one step of the undo stack, the selection beside it costing none', () => {
    addPaletteElement('process');

    expect(modelStore.getState().past).toHaveLength(1);
  });

  it('adds nothing while the model holds no diagram to add to', () => {
    emptied();

    addPaletteElement('actor');

    expect(modelStore.getState().past).toHaveLength(0);
    expect(said()).toBe('');
  });
});

describe('connectElements', () => {
  beforeEach(() => {
    opened();
  });

  it('adds one flow between the two elements and names its ends', () => {
    connectElements(readerElement, studioElement);

    expect(said()).toBe('Added New flow, flow, from Reader to Studio.');
    expect(modelStore.getState().past).toHaveLength(1);
  });

  it('refuses a flow as an end, which the layout could place nowhere', () => {
    connectElements(readerElement, requestFlow);

    expect(modelStore.getState().past).toHaveLength(0);
    expect(said()).toBe('');
  });

  it('refuses a trust boundary as an end, which a flow crosses rather than ends on', () => {
    connectElements(boundaryElement, studioElement);

    expect(modelStore.getState().past).toHaveLength(0);
    expect(said()).toBe('');
  });

  it('draws nothing while the model holds no diagram to draw on', () => {
    emptied();

    connectElements(readerElement, studioElement);

    expect(modelStore.getState().past).toHaveLength(0);
    expect(said()).toBe('');
  });
});

describe('removeSelected', () => {
  it('does nothing at all while nothing is selected', () => {
    opened();

    expect(removeSelected()).toBe(false);
    expect(modelStore.getState().past).toHaveLength(0);
    expect(said()).toBe('');
  });

  it('says nothing where the model refuses the removal', () => {
    opened(elementId('ghost-element'));

    expect(removeSelected()).toBe(false);
    expect(modelStore.getState().past).toHaveLength(0);
    expect(said()).toBe('');
  });

  it('removes the selection and says what the cascade took with it', () => {
    opened(readerElement);

    expect(removeSelected()).toBe(true);
    expect(said()).toBe(
      'Removed Reader, actor, 1 open threat, highest severity medium. 1 flow detached, 1 threat link dropped.',
    );
  });

  it('leaves the removed element out of the model and its flow attached to nothing', () => {
    opened(readerElement);

    removeSelected();

    const elements = modelStore.getState().present.diagrams[0].elements;
    expect(
      elements.find((element) => element.id === readerElement),
    ).toBeUndefined();
    expect(
      elements.find((element) => element.id === requestFlow),
    ).toMatchObject({ source: { kind: 'free' } });
  });
});
