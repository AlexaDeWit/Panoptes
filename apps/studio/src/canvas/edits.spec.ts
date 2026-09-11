import {
  emptyModel,
  type ElementId,
  type Flow,
  type Model,
} from '@saerskriven/model';
import { elementId } from '@saerskriven/model/fixtures';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';
import { currentLayout } from './layout.js';
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
  focusElement,
  placeBoundaryCurve,
  placeElement,
  removalCascade,
  removeSelected,
  resizeNode,
  selectAll,
} from './edits.js';
import { freshElement } from './elements.js';

const opened = (selection: readonly ElementId[] = []): void => {
  modelStore.setState({ ...initialState(canvasModel), selection }, true);
  resetAnnouncements();
};

const said = (): string => currentAnnouncement().message;

const emptied = (): void => {
  modelStore.setState(initialState(emptyModel), true);
  resetAnnouncements();
};

describe('focusElement', () => {
  const drawn = document.createElement('button');
  const field = document.createElement('input');
  drawn.className = 'react-flow__node';
  drawn.dataset['id'] = readerElement;

  beforeEach(() => {
    opened([readerElement]);
    vi.useFakeTimers();
    document.body.append(drawn, field);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    drawn.remove();
    field.remove();
  });

  it('waits for an element that has not rendered yet', () => {
    drawn.remove();
    focusElement(readerElement);
    document.body.append(drawn);

    vi.advanceTimersByTime(50);

    expect(document.activeElement).toBe(drawn);
  });

  it('retries when rendering removes the focused element', () => {
    focusElement(readerElement);
    drawn.remove();
    document.body.append(drawn);

    vi.advanceTimersByTime(50);

    expect(document.activeElement).toBe(drawn);
  });

  it('leaves a field focused when the user moves there before a retry', () => {
    focusElement(readerElement);
    field.focus();

    vi.advanceTimersByTime(50);

    expect(document.activeElement).toBe(field);
  });

  it('abandons a pending render retry after selection changes', () => {
    drawn.remove();
    focusElement(readerElement);
    modelStore.setState({ selection: [studioElement] });
    document.body.append(drawn);

    vi.advanceTimersByTime(50);

    expect(document.activeElement).not.toBe(drawn);
  });
});

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

  it('adds the element, selects it and opens its name without repeating it', () => {
    placeElement(
      freshElement('actor', { x: 10, y: 20 }, { width: 100, height: 50 }),
    );

    const state = modelStore.getState();
    expect(state.present.diagrams[0].elements).toHaveLength(7);
    expect(state.selection).toHaveLength(1);
    expect(state.inlineEditor).toEqual({
      kind: 'name',
      elementId: state.selection.at(0),
    });
    expect(said()).toBe('');
  });

  it('costs one step of the undo stack, the selection beside it costing none', () => {
    placeElement(
      freshElement('process', { x: 10, y: 20 }, { width: 80, height: 80 }),
    );

    expect(modelStore.getState().past).toHaveLength(1);
  });

  it('does not open a name field where the placed box cannot hold it', () => {
    placeElement(
      freshElement('actor', { x: 10, y: 20 }, { width: 100, height: 5 }),
      false,
    );

    const state = modelStore.getState();
    expect(state.selection).toHaveLength(1);
    expect(state.inlineEditor).toBeUndefined();
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

    placeElement(
      freshElement('actor', { x: 10, y: 20 }, { width: 100, height: 50 }),
    );

    expect(modelStore.getState().past).toHaveLength(0);
    expect(said()).toBe('');
  });
});

describe('connectElements', () => {
  beforeEach(() => {
    opened();
  });

  it('adds one flow between the two elements without repeating its focused name', () => {
    connectElements(readerElement, studioElement);

    expect(said()).toBe('');
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
    opened([elementId('ghost-element')]);

    expect(removeSelected()).toBe(false);
    expect(modelStore.getState().past).toHaveLength(0);
    expect(said()).toBe('');
  });

  it('removes the selection and says what the cascade took with it', () => {
    opened([readerElement]);

    expect(removeSelected()).toBe(true);
    expect(said()).toContain('Reader');
    expect(said()).toContain('1');
  });

  it('leaves the removed element out of the model and its flow attached to nothing', () => {
    opened([readerElement]);

    removeSelected();

    const elements = modelStore.getState().present.diagrams[0].elements;
    expect(
      elements.find((element) => element.id === readerElement),
    ).toBeUndefined();
    expect(
      elements.find((element) => element.id === requestFlow),
    ).toMatchObject({ source: { kind: 'free' } });
  });

  it('removes several selected elements in one undo step', () => {
    opened([readerElement, studioElement]);

    expect(removeSelected()).toBe(true);

    expect(modelStore.getState().past).toHaveLength(1);
    expect(modelStore.getState().selection).toEqual([]);
    expect(said()).toContain('2 elements');
  });
});

describe('resizeNode', () => {
  beforeEach(() => {
    opened([readerElement]);
  });

  it('commits position and size as one undo step', () => {
    const node = currentLayout(modelStore.getState()).nodes.find(
      (candidate) => candidate.id === readerElement,
    );
    expect(node).toBeDefined();
    if (node === undefined) {
      return;
    }

    resizeNode(node, {
      position: { x: -20, y: -10 },
      size: { width: 140, height: 70 },
    });

    const state = modelStore.getState();
    expect(state.past).toHaveLength(1);
    expect(
      state.present.diagrams[0].elements.find(
        (element) => element.id === readerElement,
      ),
    ).toMatchObject({
      position: { x: -20, y: -10 },
      size: { width: 140, height: 70 },
    });
  });

  it('does not commit unchanged geometry', () => {
    const node = currentLayout(modelStore.getState()).nodes.find(
      (candidate) => candidate.id === readerElement,
    );
    expect(node).toBeDefined();
    if (node !== undefined) {
      resizeNode(node, { position: node.position, size: node.size });
    }

    expect(modelStore.getState().past).toHaveLength(0);
  });
});

describe('selectAll', () => {
  it('selects every element in the diagram on screen', () => {
    opened([readerElement]);

    selectAll();

    expect(modelStore.getState().selection).toEqual(
      canvasModel.diagrams[0].elements.map((element) => element.id),
    );
    expect(modelStore.getState().past).toEqual([]);
  });

  it('leaves an unplaced flow out of the selection', () => {
    const hiddenFlow: Flow = {
      kind: 'flow',
      id: elementId('flow-hidden'),
      name: 'Hidden flow',
      description: '',
      outOfScope: false,
      reasonOutOfScope: '',
      source: { kind: 'attached', element: requestFlow },
      target: { kind: 'attached', element: readerElement },
      waypoints: [],
      bidirectional: false,
    };
    const model: Model = {
      ...canvasModel,
      diagrams: [
        {
          ...canvasModel.diagrams[0],
          elements: [...canvasModel.diagrams[0].elements, hiddenFlow],
        },
      ],
    };
    modelStore.setState(initialState(model), true);

    selectAll();

    expect(modelStore.getState().selection).not.toContain(hiddenFlow.id);
  });
});
