import { emptyModel } from '@saerskriven/model';
import { Action } from '../store/actions.js';
import { reduce } from '../store/reducer.js';
import { initialState } from '../store/state.js';
import {
  otherElement,
  secondDiagram,
  twoDiagramModel,
} from '../store/store.fixtures.js';
import { canvasModel, readerElement } from './canvas.fixtures.js';
import { currentLayout, emptyLayout } from './layout.js';

const start = initialState(canvasModel);

const moved = reduce(
  start,
  Action.MoveElement({ elementId: readerElement, offset: { x: 10, y: 0 } }),
);

describe('currentLayout', () => {
  it('lays out every element of the diagram on screen', () => {
    const layout = currentLayout(start);
    expect(layout.nodes).toHaveLength(4);
    expect(layout.edges).toHaveLength(2);
  });

  it('hands back the same layout while the model is the same object', () => {
    expect(currentLayout(start)).toBe(currentLayout(start));
  });

  it('lays the diagram out again once the model has moved', () => {
    expect(currentLayout(moved)).not.toBe(currentLayout(start));
    expect(
      currentLayout(moved).nodes.find((node) => node.id === readerElement)
        ?.position.x,
    ).toBe(10);
  });

  it('lays out the diagram chosen, and keeps each diagram of one model laid out', () => {
    const first = initialState(twoDiagramModel);
    const second = reduce(
      first,
      Action.SelectDiagram({ diagramId: secondDiagram }),
    );
    expect(currentLayout(second).nodes.map((node) => node.id)).toEqual([
      otherElement,
    ]);
    expect(currentLayout(second)).not.toBe(currentLayout(first));
    expect(currentLayout(second)).toBe(currentLayout(second));
    expect(currentLayout(first)).toBe(currentLayout(first));
  });

  it('draws nothing for a model that holds no diagram', () => {
    expect(currentLayout(initialState(emptyModel))).toBe(emptyLayout);
  });
});
