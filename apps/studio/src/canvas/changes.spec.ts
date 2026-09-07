import {
  flowEndNodeId,
  layoutAtReactFlowNodes,
  layoutDiagram,
  toReactFlowNodes,
} from '@saerskriven/canvas';
import type { ElementId, Flow } from '@saerskriven/model';
import { Action } from '../store/actions.js';
import {
  canvasModel,
  probeFlow,
  readerElement,
  requestFlow,
  studioElement,
} from './canvas.fixtures.js';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import {
  applyChanges,
  applyConnection,
  betweenTwoElements,
  gestureSelection,
  moveActions,
  selectionActions,
  type DiagramChange,
} from './changes.js';
import { elementIds, nodesById } from './nodes.js';

const layout = layoutDiagram(canvasModel.diagrams[0], canvasModel);

const elements = elementIds(layout);

const nodes = nodesById(layout);

const selecting = (id: string, selected: boolean): DiagramChange => ({
  id,
  type: 'select',
  selected,
});

const moving = (
  id: string,
  position: { x: number; y: number },
  dragging: boolean | undefined,
): DiagramChange => ({ id, type: 'position', position, dragging });

const sizing = (
  id: string,
  dimensions: { width: number; height: number },
  resizing: boolean | undefined,
): DiagramChange => ({ id, type: 'dimensions', dimensions, resizing });

const anchor = flowEndNodeId(probeFlow, 'target');

const opened = (selection: readonly ElementId[] = []): void => {
  modelStore.setState({ ...initialState(canvasModel), selection }, true);
};

const selectionHeld = (): readonly ElementId[] =>
  modelStore.getState().selection;

const flowDrawn = (): Flow | undefined => {
  const drawn = modelStore.getState().present.diagrams[0].elements.at(-1);
  return drawn?.kind === 'flow' ? drawn : undefined;
};

describe('selectionActions', () => {
  it('selects the element the changes chose', () => {
    expect(
      selectionActions([selecting(readerElement, true)], elements, []),
    ).toEqual([Action.Select({ elementIds: [readerElement] })]);
  });

  it('asks for nothing where the chosen element is the one already selected', () => {
    expect(
      selectionActions([selecting(readerElement, true)], elements, [
        readerElement,
      ]),
    ).toEqual([]);
  });

  it('clears the selection where the element holding it was dropped', () => {
    expect(
      selectionActions([selecting(readerElement, false)], elements, [
        readerElement,
      ]),
    ).toEqual([Action.Select({ elementIds: [] })]);
  });

  it('leaves a selection alone where another element was dropped', () => {
    expect(
      selectionActions([selecting(studioElement, false)], elements, [
        requestFlow,
      ]),
    ).toEqual([]);
  });

  it('takes the selection over the deselection that comes with it', () => {
    expect(
      selectionActions(
        [selecting(readerElement, false), selecting(requestFlow, true)],
        elements,
        [readerElement],
      ),
    ).toEqual([Action.Select({ elementIds: [requestFlow] })]);
  });

  it('selects nothing for an id that names no element', () => {
    expect(selectionActions([selecting(anchor, true)], elements, [])).toEqual(
      [],
    );
  });
});

describe('moveActions', () => {
  it('moves an element by the offset from where the model has it', () => {
    expect(
      moveActions([moving(readerElement, { x: 40, y: 25 }, false)], nodes, []),
    ).toEqual([
      Action.MoveElement({
        elementId: readerElement,
        offset: { x: 40, y: 25 },
      }),
    ]);
  });

  it('leaves a gesture still in flight to the canvas', () => {
    expect(
      moveActions([moving(readerElement, { x: 40, y: 25 }, true)], nodes, [
        readerElement,
      ]),
    ).toEqual([]);
  });

  it('leaves the position change of an active resize to its control', () => {
    expect(
      moveActions(
        [
          sizing(readerElement, { width: 110, height: 60 }, true),
          moving(readerElement, { x: 10, y: 0 }, undefined),
        ],
        nodes,
        [readerElement],
      ),
    ).toEqual([]);
  });

  it('asks for nothing where the element ended up where it started', () => {
    expect(
      moveActions([moving(readerElement, { x: 0, y: 0 }, false)], nodes, [
        readerElement,
      ]),
    ).toEqual([]);
  });

  it('moves nothing for an id that names no drawn node', () => {
    expect(
      moveActions([moving(anchor, { x: 9, y: 9 }, false)], nodes, []),
    ).toEqual([]);
  });

  it('moves a multi-selection through one plural action', () => {
    expect(
      moveActions([moving(readerElement, { x: 40, y: 25 }, false)], nodes, [
        readerElement,
        studioElement,
        requestFlow,
      ]),
    ).toEqual([
      Action.MoveElements({
        elementIds: [readerElement, studioElement, requestFlow],
        offset: { x: 40, y: 25 },
      }),
    ]);
  });
});

describe('gestureSelection', () => {
  const selection = [readerElement, studioElement, requestFlow];

  it('keeps the full selection for a group move', () => {
    expect(
      gestureSelection(
        [moving(readerElement, { x: 40, y: 25 }, true)],
        nodes,
        selection,
      ),
    ).toBe(selection);
  });

  it('keeps only the resized node during a multi-selection resize', () => {
    expect(
      gestureSelection(
        [sizing(readerElement, { width: 120, height: 80 }, true)],
        nodes,
        selection,
      ),
    ).toEqual([readerElement]);
  });

  it('keeps flows on untouched nodes fixed during a multi-selection resize', () => {
    const group = [readerElement, studioElement, requestFlow];
    const changes = [sizing(readerElement, { width: 120, height: 80 }, true)];
    const onScreen = toReactFlowNodes(layout).map((node) =>
      node.id === readerElement
        ? {
            ...node,
            position: { x: node.position.x, y: node.position.y - 20 },
            height: 80,
          }
        : node,
    );

    const transient = layoutAtReactFlowNodes(
      layout,
      onScreen,
      gestureSelection(changes, nodes, group),
    );

    expect(
      transient.nodes.find((node) => node.id === studioElement)?.position,
    ).toEqual(nodes.get(studioElement)?.position);
    expect(
      transient.edges.find((edge) => edge.id === requestFlow)?.target,
    ).toEqual(layout.edges.find((edge) => edge.id === requestFlow)?.target);
  });
});

describe('betweenTwoElements', () => {
  it('allows a connection between two elements', () => {
    expect(
      betweenTwoElements({
        source: readerElement,
        target: studioElement,
        sourceHandle: 'right',
        targetHandle: 'left',
      }),
    ).toBe(true);
  });

  it('refuses one that ends where it started, which draws no line', () => {
    expect(
      betweenTwoElements({
        source: readerElement,
        target: readerElement,
        sourceHandle: 'right',
        targetHandle: 'left',
      }),
    ).toBe(false);
  });
});

describe('applyConnection', () => {
  it('draws the flow a settled connection asks for', () => {
    opened();

    applyConnection(
      {
        source: readerElement,
        target: studioElement,
        sourceHandle: 'right',
        targetHandle: 'left',
      },
      elements,
    );

    expect(modelStore.getState().past).toHaveLength(1);
    expect(flowDrawn()?.source).toEqual({
      kind: 'attached',
      element: readerElement,
    });
    expect(flowDrawn()?.target).toEqual({
      kind: 'attached',
      element: studioElement,
    });
  });

  it('draws nothing for an end that names no element of the diagram', () => {
    opened();

    applyConnection(
      {
        source: readerElement,
        target: anchor,
        sourceHandle: 'right',
        targetHandle: null,
      },
      elements,
    );

    expect(modelStore.getState().past).toHaveLength(0);
  });
});

describe('applyChanges', () => {
  it('selects the element a click chose', () => {
    opened();

    applyChanges([selecting(readerElement, true)], elements, nodes);

    expect(selectionHeld()).toEqual([readerElement]);
  });

  it('moves the selection from an element to a flow, deselection last', () => {
    opened([readerElement]);

    applyChanges([selecting(requestFlow, true)], elements, nodes);
    applyChanges([selecting(readerElement, false)], elements, nodes);

    expect(selectionHeld()).toEqual([requestFlow]);
  });

  it('moves the selection from a flow to an element, deselection last', () => {
    opened([requestFlow]);

    applyChanges([selecting(readerElement, true)], elements, nodes);
    applyChanges([selecting(requestFlow, false)], elements, nodes);

    expect(selectionHeld()).toEqual([readerElement]);
  });

  it('clears the selection where nothing was chosen in its place', () => {
    opened([readerElement]);

    applyChanges([selecting(readerElement, false)], elements, nodes);

    expect(selectionHeld()).toEqual([]);
  });

  it('moves an element the model holds, so undo has something to take back', () => {
    opened();

    applyChanges(
      [moving(readerElement, { x: 40, y: 25 }, false)],
      elements,
      nodes,
    );

    expect(modelStore.getState().past).toHaveLength(1);
    expect(
      modelStore
        .getState()
        .present.diagrams[0].elements.find(
          (element) => element.id === readerElement,
        ),
    ).toMatchObject({ position: { x: 40, y: 25 } });
  });
});
