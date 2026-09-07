import { emptyModel, type ElementId } from '@saerskriven/model';
import { elementId } from '@saerskriven/model/fixtures';
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
  connectElements,
  describeRemoval,
  placeBoundaryCurve,
  placeElement,
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
    const description = describeRemoval('Reader, actor', {
      flows: 2,
      threats: 1,
    });

    expect(description).toContain('Reader');
    expect(description).toContain('2');
    expect(description).toContain('1');
  });

  it('says a count of none rather than leaving it out', () => {
    const description = describeRemoval('Reader, actor', {
      flows: 0,
      threats: 0,
    });

    expect(description).toMatch(/flow/u);
    expect(description).toMatch(/threat/u);
  });
});

describe('placing an element', () => {
  beforeEach(() => {
    opened();
  });

  it('adds the element, selects it, opens its name and says so', () => {
    placeElement('actor', { x: 10, y: 20 }, { width: 100, height: 50 });

    const state = modelStore.getState();
    expect(state.present.diagrams[0].elements).toHaveLength(7);
    expect(state.selection).toBeDefined();
    expect(state.renaming).toBe(state.selection);
    expect(said()).toContain('New actor');
  });

  it('costs one step of the undo stack, the selection beside it costing none', () => {
    placeElement('process', { x: 10, y: 20 }, { width: 80, height: 80 });

    expect(modelStore.getState().past).toHaveLength(1);
  });

  it('places a curve as one edit through the clicked waypoints', () => {
    placeBoundaryCurve([
      { x: 10, y: 20 },
      { x: 80, y: 60 },
      { x: 120, y: 20 },
    ]);

    expect(modelStore.getState().past).toHaveLength(1);
    expect(
      modelStore.getState().present.diagrams[0].elements.at(-1),
    ).toMatchObject({
      kind: 'trust-boundary',
      shape: {
        kind: 'curve',
        waypoints: [
          { x: 10, y: 20 },
          { x: 80, y: 60 },
          { x: 120, y: 20 },
        ],
      },
    });
  });

  it('refuses an unfinished curve without an undo step', () => {
    expect(placeBoundaryCurve([{ x: 10, y: 20 }])).toBe(false);

    expect(modelStore.getState().past).toHaveLength(0);
  });

  it('adds nothing while the model holds no diagram to add to', () => {
    emptied();

    placeElement('actor', { x: 10, y: 20 }, { width: 100, height: 50 });

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

    expect(said()).toContain('Reader');
    expect(said()).toContain('Studio');
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
    expect(said()).toContain('Reader');
    expect(said()).toContain('1');
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
