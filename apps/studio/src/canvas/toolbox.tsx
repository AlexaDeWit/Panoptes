import { CursorArrowIcon, HandIcon } from '@radix-ui/react-icons';
import { Select } from 'radix-ui';
import type { ReactNode } from 'react';
import { IconCommandButton } from '../commands/command-button.js';
import { toolCommands } from '../commands/registry.js';
import { useModelStore } from '../store/store.js';
import { LiveRegion } from '../ui/live-region.js';
import { useAnnouncement } from './announcements.js';
import {
  chooserOpened,
  commitFlowTarget,
  useConnecting,
} from './connecting.js';
import { flowEnds } from './elements.js';
import { currentLayout } from './layout.js';
import { isElementTool, lockTool, tools, useTool, type Tool } from './tools.js';
import styles from './toolbox.module.css';

const diagramGlyph = (drawn: ReactNode): ReactNode => (
  <svg aria-hidden="true" className={styles.glyph} viewBox="0 0 16 16">
    {drawn}
  </svg>
);

const glyphs: Record<Tool, ReactNode> = {
  select: <CursorArrowIcon aria-hidden="true" className={styles.icon} />,
  actor: diagramGlyph(<rect x="2.5" y="4" width="11" height="8" />),
  process: diagramGlyph(<circle cx="8" cy="8" r="5.5" />),
  store: diagramGlyph(<path d="M2.5 4h11M2.5 12h11" />),
  'boundary-box': diagramGlyph(<rect x="2.5" y="3" width="11" height="10" />),
  'boundary-curve': diagramGlyph(<path d="M2 11C4 3 8 3 9 8s3 5 5-2" />),
  hand: <HandIcon aria-hidden="true" className={styles.icon} />,
};

/** The floating tool modes, canvas messages and on-demand flow chooser. */
export function Toolbox() {
  const mode = useTool();
  const announcement = useAnnouncement();

  return (
    <div className={styles.toolbox} data-testid="toolbox">
      <section aria-label="Tools" className={styles.row}>
        {tools.map((tool) => (
          <IconCommandButton
            className={styles.control}
            command={toolCommands[tool]}
            key={tool}
            onDoubleClick={
              isElementTool(tool)
                ? () => {
                    lockTool(tool);
                  }
                : undefined
            }
            pressed={mode.active === tool}
          >
            {glyphs[tool]}
          </IconCommandButton>
        ))}
      </section>
      <FlowTargetChooser />
      <LiveRegion className={styles.announcement} testId="canvas-announcement">
        {announcement.message !== '' && (
          <p className={styles.message} key={announcement.sequence}>
            {announcement.message}
          </p>
        )}
      </LiveRegion>
    </div>
  );
}

function FlowTargetChooser() {
  const layout = useModelStore(currentLayout);
  const connecting = useConnecting();
  if (!connecting.open || connecting.from === undefined) {
    return null;
  }
  const targets = flowEnds(layout).filter(
    (node) => node.id !== connecting.from,
  );

  return (
    <Select.Root
      onOpenChange={chooserOpened}
      onValueChange={(value) => {
        const target = targets.find((node) => node.id === value)?.id;
        if (target !== undefined) {
          commitFlowTarget(target, connecting.from);
        }
      }}
      open
      value=""
    >
      <Select.Trigger aria-label="Flow target" className={styles.flowTrigger}>
        <Select.Value placeholder="Choose a flow target" />
      </Select.Trigger>
      <Select.Content className={styles.content} position="popper">
        <Select.Viewport className={styles.viewport}>
          {targets.map((node) => (
            <Select.Item className={styles.item} key={node.id} value={node.id}>
              <Select.ItemText>{shownName(node.id, node.name)}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Viewport>
      </Select.Content>
    </Select.Root>
  );
}

function shownName(id: string, name: string): string {
  return name === '' ? id : name;
}
