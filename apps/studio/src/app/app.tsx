import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useMemo } from 'react';
import { DiagramCanvas } from '../canvas/diagram-canvas.js';
import { EditPalette } from '../canvas/palette.js';
import { CommandSurfaceProvider } from '../commands/binding.js';
import { CommandButton } from '../commands/command-button.js';
import type { CommandSurface } from '../commands/registry.js';
import { useFileSession } from '../files/file-commands.js';
import { FileBar } from '../files/file-bar.js';
import { ThreatPanel } from '../panel/threat-panel.js';
import { canUndo, elementCount } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import styles from './app.module.css';

/**
 * The studio shell. React Flow's provider is mounted around the whole of it
 * rather than left to the canvas to raise on its own, which is what puts the
 * viewport within reach of a command: zoom and fit are the app's, and the
 * canvas is where they are drawn rather than where they are bound.
 */
export function App() {
  return (
    <ReactFlowProvider>
      <Studio />
    </ReactFlowProvider>
  );
}

/**
 * The file controls, the canvas and its palette, the threat panel beside
 * them, and what is left of the store's walking skeleton, a control that
 * undoes and a count read through a selector.
 *
 * The surface every command runs against is built here, because this is the
 * one place that holds both the file session and the viewport ([the
 * commands](../commands/README.md)). Opening and saving live in the file bar
 * ([the file bridge](../files/README.md)), drawing in the canvas ([the
 * canvas](../canvas/README.md)) and the threats in the panel ([the
 * panel](../panel/README.md)), so this mounts them rather than growing a
 * concern of any of them.
 */
function Studio() {
  const elements = useModelStore(elementCount);
  const undoable = useModelStore(canUndo);
  const session = useFileSession();
  const flow = useReactFlow();

  const surface = useMemo<CommandSurface>(
    () => ({
      files: session.commands,
      view: {
        zoomIn: () => {
          void flow.zoomIn();
        },
        zoomOut: () => {
          void flow.zoomOut();
        },
        fitToView: () => {
          void flow.fitView();
        },
      },
    }),
    [flow, session.commands],
  );

  return (
    <CommandSurfaceProvider surface={surface}>
      <div className={styles.shell}>
        <main className={styles.diagram}>
          <h1 className={styles.title}>Panoptes</h1>
          <FileBar session={session} />
          <p>
            Elements: <span data-testid="element-count">{elements}</span>
          </p>
          <CommandButton command="undo" disabled={!undoable} />
          <EditPalette />
          <DiagramCanvas />
        </main>
        <ThreatPanel />
      </div>
    </CommandSurfaceProvider>
  );
}
