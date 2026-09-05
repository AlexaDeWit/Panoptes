import { flowEndNodeId, layoutDiagram } from '@panoptes/canvas';
import { Action } from '../store/actions.js';
import {
  canvasModel,
  probeFlow,
  readerElement,
  requestFlow,
  studioElement,
} from './canvas.fixtures.js';
import {
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
  dragging: boolean,
): DiagramChange => ({ id, type: 'position', position, dragging });

const anchor = flowEndNodeId(probeFlow, 'target');

describe('selectionActions', () => {
  it('selects the element the changes chose', () => {
    expect(
      selectionActions([selecting(readerElement, true)], elements, undefined),
    ).toEqual([Action.Select({ elementId: readerElement })]);
  });

  it('asks for nothing where the chosen element is the one already selected', () => {
    expect(
      selectionActions(
        [selecting(readerElement, true)],
        elements,
        readerElement,
      ),
    ).toEqual([]);
  });

  it('clears the selection where the element holding it was dropped', () => {
    expect(
      selectionActions(
        [selecting(readerElement, false)],
        elements,
        readerElement,
      ),
    ).toEqual([Action.Select({ elementId: undefined })]);
  });

  it('leaves a selection alone where another element was dropped', () => {
    expect(
      selectionActions(
        [selecting(studioElement, false)],
        elements,
        requestFlow,
      ),
    ).toEqual([]);
  });

  it('takes the selection over the deselection that comes with it', () => {
    expect(
      selectionActions(
        [selecting(readerElement, false), selecting(requestFlow, true)],
        elements,
        readerElement,
      ),
    ).toEqual([Action.Select({ elementId: requestFlow })]);
  });

  it('selects nothing for an id that names no element', () => {
    expect(
      selectionActions([selecting(anchor, true)], elements, undefined),
    ).toEqual([]);
  });
});

describe('moveActions', () => {
  it('moves an element by the offset from where the model has it', () => {
    expect(
      moveActions([moving(readerElement, { x: 40, y: 25 }, false)], nodes),
    ).toEqual([
      Action.MoveElement({
        elementId: readerElement,
        offset: { x: 40, y: 25 },
      }),
    ]);
  });

  it('leaves a gesture still in flight to the canvas', () => {
    expect(
      moveActions([moving(readerElement, { x: 40, y: 25 }, true)], nodes),
    ).toEqual([]);
  });

  it('asks for nothing where the element ended up where it started', () => {
    expect(
      moveActions([moving(readerElement, { x: 0, y: 0 }, false)], nodes),
    ).toEqual([]);
  });

  it('moves nothing for an id that names no drawn node', () => {
    expect(moveActions([moving(anchor, { x: 9, y: 9 }, false)], nodes)).toEqual(
      [],
    );
  });
});
