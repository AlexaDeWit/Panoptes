import { DiagramCanvas } from '../canvas/diagram-canvas.js';
import { EditPalette } from '../canvas/palette.js';
import { FileBar } from '../files/file-bar.js';
import { ThreatPanel } from '../panel/threat-panel.js';
import { Action } from '../store/actions.js';
import { canUndo, elementCount } from '../store/selectors.js';
import { dispatch, useModelStore } from '../store/store.js';
import styles from './app.module.css';

/**
 * The studio shell: the file controls, the canvas and its palette, the threat
 * panel beside them, and what is left of the store's walking skeleton, a
 * control that dispatches an undo and a count read through a selector.
 * Opening and saving live in the file bar ([the file
 * bridge](../files/README.md)), drawing in the canvas ([the
 * canvas](../canvas/README.md)) and the threats in the panel ([the
 * panel](../panel/README.md)), so this mounts them rather than growing a
 * concern of any of them.
 */
export function App() {
  const elements = useModelStore(elementCount);
  const undoable = useModelStore(canUndo);

  return (
    <div className={styles.shell}>
      <main className={styles.diagram}>
        <h1 className={styles.title}>Panoptes</h1>
        <FileBar />
        <p>
          Elements: <span data-testid="element-count">{elements}</span>
        </p>
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
