import { ReactFlowProvider } from '@xyflow/react';
import { useMemo } from 'react';
import { DiagramCanvas } from '../canvas/diagram-canvas.js';
import { useViewCommands } from '../canvas/view-commands.js';
import { CommandSurfaceProvider } from '../commands/binding.js';
import type { CommandSurface } from '../commands/registry.js';
import { useFileSession } from '../files/file-commands.js';
import { StudioMenu } from '../files/menu.js';
import styles from './app.module.css';

/** The studio shell and the provider that exposes its viewport commands. */
export function App() {
  return (
    <ReactFlowProvider>
      <Studio />
    </ReactFlowProvider>
  );
}

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
          <h1 className={styles.title}>Saerskriven</h1>
          <div className={styles.stage}>
            <StudioMenu session={session} />
            <DiagramCanvas />
          </div>
        </main>
      </div>
    </CommandSurfaceProvider>
  );
}
