import { PanoptesCanvas } from '@panoptes/canvas';
import { generateElementId, type Element } from '@panoptes/model';
import { Action } from '../store/actions.js';
import { canUndo, elementCount, firstDiagramId } from '../store/selectors.js';
import { dispatch, useModelStore } from '../store/store.js';

function freshProcess(): Element {
  return {
    kind: 'process',
    id: generateElementId(),
    name: 'New process',
    description: '',
    outOfScope: false,
    reasonOutOfScope: '',
    position: { x: 40, y: 160 },
    size: { width: 120, height: 60 },
  };
}

/**
 * The studio, so far the walking skeleton of the model store: a control that
 * dispatches a model edit, a control that dispatches an undo, and a count
 * read through a selector, which re-renders itself when the model moves.
 * Issue #38 puts the interactive canvas where the placeholder is.
 */
export function App() {
  const elements = useModelStore(elementCount);
  const undoable = useModelStore(canUndo);
  const diagram = useModelStore(firstDiagramId);
  const add =
    diagram === undefined
      ? undefined
      : () => {
          dispatch(
            Action.AddElement({ diagramId: diagram, element: freshProcess() }),
          );
        };
  return (
    <main>
      <p>
        Elements: <span data-testid="element-count">{elements}</span>
      </p>
      <button type="button" disabled={add === undefined} onClick={add}>
        Add a process
      </button>
      <button
        type="button"
        disabled={!undoable}
        onClick={() => {
          dispatch(Action.Undo());
        }}
      >
        Undo
      </button>
      <PanoptesCanvas />
    </main>
  );
}
