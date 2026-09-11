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
import {
  SelectionControls,
  FlowEndpointCommands,
} from './selection-controls.js';
import { commandById, runCommand } from '../commands/registry.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { resetTools, selectTool } from './tools.js';
import { currentAnnouncement } from './announcements.js';
import { newProcess } from '../store/store.fixtures.js';

const flowOf = () =>
  modelStore
    .getState()
    .present.diagrams[0].elements.find((element) => element.kind === 'flow');

const actor = placeholderModel.diagrams[0].elements[0].id;

beforeEach(() => {
  resetTools();
  modelStore.setState(
    { ...initialState(placeholderModel), selection: [actor] },
    true,
  );
});

it('holds geometry drafts until Apply and records position plus size as one edit', async () => {
  render(<SelectionControls />);
  act(() => {
    runCommand(commandById('edit-geometry'), recordingSurface().surface);
  });
  await waitFor(() => {
    expect(document.activeElement).toBe(
      screen.getByRole('spinbutton', { name: 'X' }),
    );
  });
  fireEvent.click(screen.getByRole('button', { name: 'Increase X' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Height' }), {
    target: { value: '90' },
  });
  expect(modelStore.getState().present).toBe(placeholderModel);
  fireEvent.click(screen.getByRole('button', { name: 'Apply geometry' }));
  expect(modelStore.getState().past).toEqual([placeholderModel]);
  expect(modelStore.getState().present.diagrams[0].elements[0]).toMatchObject({
    position: { x: 41 },
    size: { height: 90 },
  });
  expect(
    screen.queryByRole('region', { name: 'Position and size' }),
  ).toBeNull();
});

it('retains invalid dimensions and cancels by Escape without history', () => {
  render(<SelectionControls />);
  act(() => {
    runCommand(commandById('edit-geometry'), recordingSurface().surface);
  });
  const width = screen.getByRole('spinbutton', { name: 'Width' });
  fireEvent.change(width, { target: { value: '-2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply geometry' }));
  expect(modelStore.getState().present).toBe(placeholderModel);
  expect(currentAnnouncement().message).toContain('positive');
  width.focus();
  fireEvent.keyDown(width, { key: 'Escape' });
  expect(screen.queryByRole('region')).toBeNull();
  expect(modelStore.getState().past).toEqual([]);
});

it('moves a multi-selection by one offset and invalidates a draft on tool changes', () => {
  modelStore.setState(
    {
      ...initialState(placeholderModel),
      selection: placeholderModel.diagrams[0].elements.map(
        (element) => element.id,
      ),
    },
    true,
  );
  render(<SelectionControls />);
  act(() => {
    runCommand(commandById('edit-geometry'), recordingSurface().surface);
  });
  expect(screen.queryByRole('spinbutton', { name: 'Width' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Decrease Y' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply geometry' }));
  expect(
    modelStore.getState().present.diagrams[0].elements.slice(0, 2),
  ).toEqual(
    placeholderModel.diagrams[0].elements
      .slice(0, 2)
      .map((element) =>
        'position' in element
          ? { ...element, position: { ...element.position, y: 39 } }
          : element,
      ),
  );
  expect(modelStore.getState().past).toEqual([placeholderModel]);
  act(() => {
    runCommand(commandById('edit-geometry'), recordingSurface().surface);
    selectTool('hand');
  });
  expect(screen.queryByRole('region')).toBeNull();
});

it('changes either endpoint with a chooser and keeps cancelling out of history', () => {
  dispatch(
    Action.AddElement({
      diagramId: placeholderModel.diagrams[0].id,
      element: newProcess('extra-node', 'Extra'),
    }),
  );
  const base = modelStore.getState().present;
  const flow = base.diagrams[0].elements.find(
    (element) => element.kind === 'flow',
  );
  if (flow === undefined) {
    throw new Error('The fixture has no flow.');
  }
  modelStore.setState({ ...initialState(base), selection: [flow.id] }, true);
  render(
    <>
      <SelectionControls />
      <FlowEndpointCommands />
    </>,
  );
  expect(
    screen.getByRole('button', { name: 'Change flow source' }),
  ).toBeDefined();
  act(() => {
    runCommand(commandById('reconnect-source'), recordingSurface().surface);
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Source' }), {
    target: { value: 'extra-node' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply endpoint' }));
  expect(
    modelStore
      .getState()
      .present.diagrams[0].elements.find((element) => element.id === flow.id),
  ).toMatchObject({
    source: { kind: 'attached', element: 'extra-node' },
  });
  act(() => {
    runCommand(commandById('reconnect-target'), recordingSurface().surface);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(modelStore.getState().past).toEqual([base]);
});

it('reports a flow-only geometry selection and ignores editor requests during placement', () => {
  const flow = placeholderModel.diagrams[0].elements[2];
  modelStore.setState(
    { ...initialState(placeholderModel), selection: [flow.id] },
    true,
  );
  render(<SelectionControls />);
  act(() => {
    runCommand(commandById('edit-geometry'), recordingSurface().surface);
  });
  expect(screen.queryByRole('spinbutton')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  act(() => {
    selectTool('actor');
    runCommand(commandById('edit-geometry'), recordingSurface().surface);
  });
  expect(screen.queryByRole('region')).toBeNull();
});

it('pins the chosen endpoint to a side, and releases it, through the endpoint editor', () => {
  const flow = placeholderModel.diagrams[0].elements.find(
    (element) => element.kind === 'flow',
  );
  if (flow === undefined) {
    throw new Error('The placeholder holds a flow');
  }
  modelStore.setState(
    { ...initialState(placeholderModel), selection: [flow.id] },
    true,
  );
  render(<SelectionControls />);
  act(() => {
    runCommand(commandById('reconnect-source'), recordingSurface().surface);
  });
  const side = screen.getByRole<HTMLSelectElement>('combobox', {
    name: 'Side',
  });
  expect(side.value).toBe('');
  fireEvent.change(side, { target: { value: 'bottom' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply endpoint' }));
  expect(flowOf()).toMatchObject({
    source: { kind: 'attached', element: actor, side: 'bottom' },
  });
  expect(modelStore.getState().past).toHaveLength(1);
  act(() => {
    runCommand(commandById('reconnect-source'), recordingSurface().surface);
  });
  expect(
    screen.getByRole<HTMLSelectElement>('combobox', { name: 'Side' }).value,
  ).toBe('bottom');
  fireEvent.change(screen.getByRole('combobox', { name: 'Side' }), {
    target: { value: '' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply endpoint' }));
  expect(flowOf()?.kind === 'flow' && flowOf()?.source).toEqual({
    kind: 'attached',
    element: actor,
  });
});

it('toggles a flow between one way and both ways as one undo step each', () => {
  const flow = placeholderModel.diagrams[0].elements.find(
    (element) => element.kind === 'flow',
  );
  if (flow === undefined) {
    throw new Error('The placeholder holds a flow');
  }
  modelStore.setState(
    { ...initialState(placeholderModel), selection: [flow.id] },
    true,
  );
  render(<FlowEndpointCommands />);
  fireEvent.click(
    screen.getByRole('button', { name: /Toggle bidirectional flow/u }),
  );
  expect(flowOf()).toMatchObject({ bidirectional: true });
  expect(currentAnnouncement().message).toContain('both ways');
  fireEvent.click(
    screen.getByRole('button', { name: /Toggle bidirectional flow/u }),
  );
  expect(flowOf()).toMatchObject({ bidirectional: false });
  expect(modelStore.getState().past).toHaveLength(2);
});
