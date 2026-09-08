import { CommandSurfaceProvider } from '../commands/binding.js';
import { CommandButton } from '../commands/command-button.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { currentSnap, useSnap } from './snap.js';
import { ReactFlow } from '@xyflow/react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Action } from '../store/actions.js';
import { initialState, placeholderModel } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { nativeSource } from '../store/store.fixtures.js';
import { canvasModel, readerElement } from './canvas.fixtures.js';
import { FitOnOpen, useViewCommands } from './view-commands.js';

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

function ViewControls() {
  const snapping = useSnap();
  const view = useViewCommands();
  return (
    <CommandSurfaceProvider surface={{ ...recordingSurface().surface, view }}>
      <CommandButton command="fit-selection" />
      <CommandButton command="fit-to-view" />
      <CommandButton command="reset-zoom" />
      <CommandButton command="zoom-in" />
      <CommandButton command="zoom-out" />
      <CommandButton command="snap-to-grid" />
      <span data-testid="snap-state">{snapping ? 'on' : 'off'}</span>
    </CommandSurfaceProvider>
  );
}

it('fits a selected flow and resets zoom without editing the document or its history', async () => {
  const flow = placeholderModel.diagrams[0].elements[2];
  modelStore.setState(
    { ...initialState(placeholderModel), selection: [flow.id] },
    true,
  );
  const before = modelStore.getState();
  render(
    <ReactFlow width={800} height={600} edges={[]} nodes={[]}>
      <ViewControls />
    </ReactFlow>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Fit selection' }));
  const selected = await fitted();
  fireEvent.click(screen.getByRole('button', { name: 'Fit to view' }));
  await waitFor(() => {
    expect(transform()).not.toBe(selected);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reset zoom to 100%' }));
  await waitFor(() => {
    expect(transform()).toContain('scale(1)');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
  await waitFor(() => {
    expect(transform()).not.toContain('scale(1)');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
  const snapping = currentSnap();
  fireEvent.click(screen.getByRole('button', { name: 'Snap to grid' }));
  expect(currentSnap()).toBe(!snapping);
  fireEvent.click(screen.getByRole('button', { name: 'Snap to grid' }));
  expect(currentSnap()).toBe(snapping);
  expect(modelStore.getState()).toBe(before);
  act(() => {
    dispatch(Action.Select({ elementIds: [] }));
  });
  const at = transform();
  fireEvent.click(screen.getByRole('button', { name: 'Fit selection' }));
  expect(transform()).toBe(at);
});
