import { ReactFlow } from '@xyflow/react';
import { act, render, waitFor } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { initialState, placeholderModel } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { nativeSource } from '../store/store.fixtures.js';
import { canvasModel, readerElement } from './canvas.fixtures.js';
import { FitOnOpen } from './view-commands.js';

const unfitted = 'transform: translate(0px, 0px) scale(1)';

const transform = (): string =>
  document.querySelector('.react-flow__viewport')?.getAttribute('style') ?? '';

const Harness = () => (
  <ReactFlow edges={[]} nodes={[]}>
    <FitOnOpen />
  </ReactFlow>
);

const fitted = async (): Promise<string> => {
  await waitFor(() => {
    expect(transform()).not.toBe(unfitted);
  });
  return transform();
};

describe('FitOnOpen', () => {
  beforeEach(() => {
    modelStore.setState(initialState(canvasModel), true);
  });

  it('fits the viewport to the model the studio opened on', async () => {
    render(<Harness />);

    expect(await fitted()).not.toBe(unfitted);
  });

  it('fits again for a file opened over the model on screen', async () => {
    render(<Harness />);
    const first = await fitted();

    act(() => {
      dispatch(
        Action.Opened({
          model: placeholderModel,
          name: 'other.yaml',
          source: nativeSource,
          divergences: [],
        }),
      );
    });

    await waitFor(() => {
      expect(transform()).not.toBe(first);
    });
  });

  it('leaves the viewport where it is for an edit', async () => {
    render(<Harness />);
    const first = await fitted();

    act(() => {
      dispatch(
        Action.MoveElement({
          elementId: readerElement,
          offset: { x: 400, y: 400 },
        }),
      );
    });

    expect(transform()).toBe(first);
  });
});
