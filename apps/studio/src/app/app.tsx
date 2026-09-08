import { ReactFlowProvider } from '@xyflow/react';
import { useMemo, useState } from 'react';
import { DiagramCanvas } from '../canvas/diagram-canvas.js';
import { useViewCommands } from '../canvas/view-commands.js';
import { CommandSurfaceProvider } from '../commands/binding.js';
import type { CommandSurface } from '../commands/registry.js';
import {
  ShortcutReference,
  useShortcutReference,
} from '../commands/shortcut-reference.js';
import { useFileSession } from '../files/file-commands.js';
import { StudioMenu } from '../files/menu.js';
import { useColourMode } from '../theme.js';
import { studioReleaseTag, studioVersion } from '../version.js';
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
  const paneCoverage = useState(0);
  const view = useViewCommands(paneCoverage[0]);
  const [colourMode, setColourMode] = useColourMode();
  const reference = useShortcutReference();

  const surface = useMemo<CommandSurface>(
    () => ({
      files: session.commands,
      reference: reference.commands,
      view,
    }),
    [reference.commands, session.commands, view],
  );

  return (
    <CommandSurfaceProvider surface={surface}>
      <div className={styles.shell}>
        <main className={styles.diagram}>
          <h1 className={styles.title}>Saerskriven</h1>
          <div className={styles.stage}>
            <StudioMenu
              colourMode={colourMode}
              onColourModeChange={setColourMode}
              session={session}
              triggerRef={reference.menuTrigger}
            />
            <DiagramCanvas paneCoverage={paneCoverage} />
            <span className={styles.version} data-testid="studio-version">
              {studioVersion}
              {studioReleaseTag === '' && ' (development)'}
            </span>
            {reference.open && <ShortcutReference onClose={reference.close} />}
          </div>
        </main>
      </div>
    </CommandSurfaceProvider>
  );
}
