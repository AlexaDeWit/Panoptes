import {
  generateElementId,
  threatSchema,
  type Element,
  type Severity,
  type Threat,
} from '@panoptes/model';
import { DiagramCanvas } from '../canvas/diagram-canvas.js';
import { FileBar } from '../files/file-bar.js';
import { Action } from '../store/actions.js';
import {
  canUndo,
  editedThreat,
  elementCount,
  firstDiagramId,
} from '../store/selectors.js';
import { dispatch, useModelStore } from '../store/store.js';
import { SeverityField } from '../ui/severity-field.js';
import styles from './app.module.css';

const threatFields = threatSchema.keyof().options;

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
 * The panel's commit handler, bound to the threat on screen. A control hands
 * it the fields it changed and the change leaves as one `ReplaceThreat`, so
 * every field of the panel commits the same way and issue #40 adds controls
 * rather than dispatch sites. A patch that leaves every field as it was
 * dispatches nothing: a model operation returns a new model whatever it was
 * asked to do, so the store would push an undo entry and mark the file dirty
 * over an edit nobody made. Fields are compared by identity, which is exact
 * for the threat's scalars and reads a rebuilt `elements` array as a change.
 */
export function threatCommitter(
  send: (action: Action) => void,
  threat: Threat | undefined,
): (patch: Partial<Threat>) => void {
  return (patch) => {
    if (threat === undefined) {
      return;
    }
    const edited = { ...threat, ...patch };
    if (threatFields.some((field) => edited[field] !== threat[field])) {
      send(Action.ReplaceThreat({ threat: edited }));
    }
  };
}

/**
 * The studio shell: the file controls, the canvas and the store's walking
 * skeleton beside it, a control that dispatches a model edit, a control that
 * dispatches an undo and a count read through a selector, plus the panel of
 * composed controls. The panel edits the threat a selector names, and its
 * commit is a dispatch like any other, so the same Undo control takes it
 * back. Opening, saving, and everything they report live in the file bar
 * ([the file bridge](../files/README.md)), so this mounts one component
 * rather than growing a file path of its own, as it mounts the canvas
 * ([the canvas](../canvas/README.md)). Issue #40 puts the rest of the panel
 * beside them.
 */
export function App() {
  const elements = useModelStore(elementCount);
  const undoable = useModelStore(canUndo);
  const diagram = useModelStore(firstDiagramId);
  const threat = useModelStore(editedThreat);
  const add =
    diagram === undefined
      ? undefined
      : () => {
          dispatch(
            Action.AddElement({ diagramId: diagram, element: freshProcess() }),
          );
        };
  const commitThreat = threatCommitter(dispatch, threat);
  const commitSeverity = (severity: Severity): void => {
    commitThreat({ severity });
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
        <DiagramCanvas />
      </main>
      <section aria-label="Threat details" className={styles.panel}>
        <SeverityField
          onCommit={commitSeverity}
          value={threat?.severity ?? 'undecided'}
        />
      </section>
    </div>
  );
}
