import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { arrangementMoves, arrangeSelected } from './arrangement.js';
import { currentLayout } from './layout.js';

it('aligns against outer bounds without changing flow metadata or creating a no-op history entry', () => {
  modelStore.setState(
    {
      ...initialState(placeholderModel),
      selection: placeholderModel.diagrams[0].elements.map(
        (element) => element.id,
      ),
    },
    true,
  );
  const nodes = currentLayout(modelStore.getState()).nodes;
  expect(arrangementMoves(nodes, 'left')).toEqual(
    nodes.map((node) => ({
      elementId: node.id,
      offset: { x: nodes[0].position.x - node.position.x, y: 0 },
    })),
  );
  arrangeSelected('left');
  const state = modelStore.getState();
  expect(state.past).toEqual([placeholderModel]);
  expect(
    state.present.diagrams[0].elements.find(
      (element) => element.kind === 'flow',
    ),
  ).toEqual(
    placeholderModel.diagrams[0].elements.find(
      (element) => element.kind === 'flow',
    ),
  );
  arrangeSelected('left');
  expect(modelStore.getState().present).toBe(state.present);
});

it('distributes unequal sizes with fixed outer nodes and equal gaps', () => {
  const base = currentLayout(initialState(placeholderModel)).nodes[0];
  const nodes = [
    { ...base, position: { x: 0, y: 20 }, size: { width: 40, height: 30 } },
    { ...base, position: { x: 70, y: 20 }, size: { width: 80, height: 30 } },
    { ...base, position: { x: 300, y: 20 }, size: { width: 60, height: 30 } },
  ];
  expect(arrangementMoves(nodes, 'horizontal')).toEqual([
    { elementId: base.id, offset: { x: 60, y: 0 } },
  ]);
  expect(arrangementMoves(nodes.slice(0, 2), 'horizontal')).toEqual([]);
});
