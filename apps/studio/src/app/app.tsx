import { ReactFlowProvider } from '@xyflow/react';
import { useMemo } from 'react';
import { DiagramCanvas } from '../canvas/diagram-canvas.js';
import { EditPalette } from '../canvas/palette.js';
import { useViewCommands } from '../canvas/view-commands.js';
import { CommandSurfaceProvider } from '../commands/binding.js';
import type { CommandSurface } from '../commands/registry.js';
import { useFileSession } from '../files/file-commands.js';
import { StudioMenu } from '../files/menu.js';
import { ThreatPanel } from '../panel/threat-panel.js';
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
 * The canvas and its palette, the menu over the top left of the canvas, and
 * the threat panel beside them.
 *
 * The surface every command runs against is built here, because this is the
 * one place that holds both the file session and the viewport ([the
 * commands](../commands/README.md)). The viewport half comes from the canvas,
 * which is what knows how a diagram is fitted into it ([the
 * canvas](../canvas/README.md)), so the zoom cluster's fit and the fit an
 * open performs are one answer rather than two that drift.
 *
 * Opening, saving and closing live in the menu ([the file
 * bridge](../files/README.md)), drawing in the canvas ([the
 * canvas](../canvas/README.md)) and the threats in the panel ([the
 * panel](../panel/README.md)), so this mounts them rather than growing a
 * concern of any of them.
 *
 * The heading names the page and is drawn nowhere: the chrome overlays the
 * canvas, so a title bar would take width from the diagram, and a page with
 * no heading at all is what the accessibility audit asks after.
 */
function Studio() {
  const session = useFileSession();
  const view = useViewCommands();

  const surface = useMemo<CommandSurface>(
    () => ({ files: session.commands, view }),
    [session.commands, view],
  );

  return (
    <CommandSurfaceProvider surface={surface}>
      <div className={styles.shell}>
        <main className={styles.diagram}>
          <h1 className={styles.title}>Panoptes</h1>
          <EditPalette />
          <div className={styles.stage}>
            <StudioMenu session={session} />
            <DiagramCanvas />
          </div>
        </main>
        <ThreatPanel />
      </div>
    </CommandSurfaceProvider>
  );
}
