import { useState } from 'react';
import { PanoptesCanvas } from '@panoptes/canvas';
import {
  generateElementId,
  type Element,
  type Severity,
} from '@panoptes/model';
import { Action } from '../store/actions.js';
import { canUndo, elementCount, firstDiagramId } from '../store/selectors.js';
import { dispatch, useModelStore } from '../store/store.js';
import { SeverityField } from '../ui/severity-field.js';
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
 * The studio shell: the diagram and the store's walking skeleton beside it, a
 * control that dispatches a model edit, a control that dispatches an undo and
 * a count read through a selector, plus the panel the composed controls live
 * in. Issue #38 puts the interactive canvas where the placeholder is.
 */
export function App() {
  const elements = useModelStore(elementCount);
  const undoable = useModelStore(canUndo);
  const diagram = useModelStore(firstDiagramId);
  const [severity, setSeverity] = useState<Severity>('undecided');
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
      <section aria-label="Threat details" className={styles.panel}>
        <SeverityField onCommit={setSeverity} value={severity} />
      </section>
    </div>
  );
}
