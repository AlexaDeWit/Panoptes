import { emptyModel } from '@panoptes/model';
import { Action } from '../store/actions.js';
import { reduce } from '../store/reducer.js';
import { initialState } from '../store/state.js';
import { canvasModel, readerElement } from './canvas.fixtures.js';
import { currentLayout, emptyLayout, selectedElement } from './layout.js';

const start = initialState(canvasModel);

const moved = reduce(
  start,
  Action.MoveElement({ elementId: readerElement, offset: { x: 10, y: 0 } }),
);

describe('currentLayout', () => {
  it('lays out every element of the diagram on screen', () => {
    const layout = currentLayout(start);
    expect(layout.nodes).toHaveLength(2);
    expect(layout.edges).toHaveLength(2);
  });

  it('hands back the same layout while the model is the same object', () => {
    expect(currentLayout(start)).toBe(currentLayout(start));
  });

  it('lays the diagram out again once the model has moved', () => {
    expect(currentLayout(moved)).not.toBe(currentLayout(start));
    expect(currentLayout(moved).nodes[0].position.x).toBe(10);
  });

  it('draws nothing for a model that holds no diagram', () => {
    expect(currentLayout(initialState(emptyModel))).toBe(emptyLayout);
  });
});

describe('selectedElement', () => {
  it('reads the selection the store holds', () => {
    expect(selectedElement(start)).toBeUndefined();
    expect(
      selectedElement(
        reduce(start, Action.Select({ elementId: readerElement })),
      ),
    ).toBe(readerElement);
  });
});
