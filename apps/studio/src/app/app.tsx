import { generateElementId, type Element } from '@panoptes/model';
import { DiagramCanvas } from '../canvas/diagram-canvas.js';
import { EditPalette } from '../canvas/palette.js';
import { FileBar } from '../files/file-bar.js';
import { ThreatPanel } from '../panel/threat-panel.js';
import { Action } from '../store/actions.js';
import { canUndo, elementCount, firstDiagramId } from '../store/selectors.js';
import { dispatch, useModelStore } from '../store/store.js';
import styles from './app.module.css';

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
 * The studio shell: the file controls, the canvas, the threat panel beside
 * it, and what is left of the store's walking skeleton, a control that
 * dispatches a model edit, a control that dispatches an undo and a count read
 * through a selector. Opening and saving live in the file bar ([the file
 * bridge](../files/README.md)), the diagram in the canvas ([the
 * canvas](../canvas/README.md)) and the threats in the panel ([the
 * panel](../panel/README.md)), so this mounts three components rather than
 * growing a concern of any of them.
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
    <div className={styles.shell}>
      <main className={styles.diagram}>
        <h1 className={styles.title}>Panoptes</h1>
        <FileBar />
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
        <EditPalette />
        <DiagramCanvas />
      </main>
      <ThreatPanel />
    </div>
  );
}
