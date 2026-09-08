import {
  commandById,
  runCommand,
  type CommandId,
} from '../commands/registry.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { sampleModel } from '../store/store.fixtures.js';
import { Action } from '../store/actions.js';
import { dispatch } from '../store/store.js';
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

const alignments: readonly (readonly [
  CommandId,
  readonly (readonly [number, number])[],
])[] = [
  [
    'align-left',
    [
      [0, 20],
      [0, 120],
    ],
  ],
  [
    'align-centre',
    [
      [70, 20],
      [50, 120],
    ],
  ],
  [
    'align-right',
    [
      [140, 20],
      [100, 120],
    ],
  ],
  [
    'align-top',
    [
      [0, 20],
      [100, 20],
    ],
  ],
  [
    'align-middle',
    [
      [0, 85],
      [100, 70],
    ],
  ],
  [
    'align-bottom',
    [
      [0, 150],
      [100, 120],
    ],
  ],
];

it.each(alignments)(
  '%s uses the selected outer bounds and preserves one-step undo',
  (command, expected) => {
    const positions = [
      { x: 0, y: 20 },
      { x: 100, y: 120 },
    ];
    const sizes = [
      { width: 40, height: 30 },
      { width: 80, height: 60 },
    ];
    const model = {
      ...placeholderModel,
      diagrams: placeholderModel.diagrams.map((diagram) => ({
        ...diagram,
        elements: diagram.elements.map((element, index) =>
          'position' in element
            ? { ...element, position: positions[index], size: sizes[index] }
            : element,
        ),
      })),
    };
    modelStore.setState(
      {
        ...initialState(model),
        selection: model.diagrams[0].elements.map((element) => element.id),
      },
      true,
    );
    runCommand(commandById(command), recordingSurface().surface);
    expect(
      modelStore
        .getState()
        .present.diagrams[0].elements.filter((element) => 'position' in element)
        .map((element) =>
          'position' in element ? [element.position.x, element.position.y] : [],
        ),
    ).toEqual(expected);
    expect(modelStore.getState().past).toEqual([model]);
    dispatch(Action.Undo());
    expect(modelStore.getState().present).toBe(model);
  },
);

it.each(['distribute-horizontal', 'distribute-vertical'] as const)(
  '%s fixes the outer nodes and leaves equal gaps',
  (command) => {
    const starts = [0, 70, 300];
    const sizes = [40, 80, 60];
    const model = {
      ...sampleModel,
      diagrams: sampleModel.diagrams.map((diagram) => ({
        ...diagram,
        elements: diagram.elements.map((element, index) =>
          'position' in element
            ? {
                ...element,
                position: { x: starts[index], y: starts[index] },
                size: { width: sizes[index], height: sizes[index] },
              }
            : element,
        ),
      })),
    };
    modelStore.setState(
      {
        ...initialState(model),
        selection: model.diagrams[0].elements.map((element) => element.id),
      },
      true,
    );
    runCommand(commandById(command), recordingSurface().surface);
    const nodes = currentLayout(modelStore.getState()).nodes;
    const axis = command === 'distribute-horizontal' ? 'x' : 'y';
    expect(nodes.map((node) => node.position[axis])).toEqual([0, 130, 300]);
    expect(modelStore.getState().past).toEqual([model]);
  },
);

it('does not dirty a selection with too few nodes to arrange', () => {
  modelStore.setState(initialState(placeholderModel), true);
  const before = modelStore.getState();
  runCommand(commandById('align-left'), recordingSurface().surface);
  expect(modelStore.getState()).toBe(before);
});
