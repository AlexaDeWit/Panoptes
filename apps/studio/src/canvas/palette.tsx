import type { ElementId } from '@panoptes/model';
import { Select } from 'radix-ui';
import { useId, useState } from 'react';
import { useModelStore } from '../store/store.js';
import { LiveRegion } from '../ui/live-region.js';
import { useAnnouncement } from './announcements.js';
import { addPaletteElement, connectElements } from './edits.js';
import { flowEnds, paletteKinds, paletteNames } from './elements.js';
import { currentLayout, selectedElement } from './layout.js';
import styles from './palette.module.css';

/**
 * The canvas's editing controls: a button per element kind, a listbox that
 * draws a flow from the selected element to any other, and the region that
 * says what an edit did.
 *
 * The source of a flow is whatever the canvas has selected, so connecting by
 * keyboard is selecting an element and then choosing a target, with no mode
 * to enter or leave. Both controls are disabled while the selection is not
 * one of the elements a flow runs between, and the listbox offers only those,
 * so neither end can be a trust boundary, a text note or a flow.
 *
 * The region is the studio's own `LiveRegion` ([the studio's
 * UI](../ui/README.md)), named so a screen reader's landmark list says which
 * region it reached. What it says is keyed by the announcement's own count,
 * so the same words twice over are two announcements rather than one: a live
 * region speaks when its content changes, and adding two actors says the same
 * sentence each time.
 */
export function EditPalette() {
  const layout = useModelStore(currentLayout);
  const selection = useModelStore(selectedElement);
  const announcement = useAnnouncement();
  const [target, setTarget] = useState<ElementId | undefined>(undefined);
  const triggerId = useId();

  const ends = flowEnds(layout);
  const source = ends.find((node) => node.id === selection);
  const targets = ends.filter((node) => node.id !== source?.id);
  const chosen = targets.find((node) => node.id === target);

  return (
    <div className={styles.palette}>
      <section aria-label="Add an element" className={styles.group}>
        {paletteKinds.map((kind) => (
          <button
            className={styles.control}
            key={kind}
            onClick={() => {
              addPaletteElement(kind);
            }}
            type="button"
          >
            {paletteNames[kind]}
          </button>
        ))}
      </section>
      <section
        aria-label="Connect the selected element"
        className={styles.group}
      >
        <label className={styles.label} htmlFor={triggerId}>
          Flow to
        </label>
        <Select.Root
          onValueChange={(value) => {
            setTarget(targets.find((node) => node.id === value)?.id);
          }}
          value={target ?? ''}
        >
          <Select.Trigger
            className={styles.trigger}
            disabled={source === undefined}
            id={triggerId}
          >
            <Select.Value placeholder="Nothing chosen" />
            <Select.Icon className={styles.icon}>▾</Select.Icon>
          </Select.Trigger>
          <Select.Content className={styles.content} position="popper">
            <Select.Viewport className={styles.viewport}>
              {targets.map((node) => (
                <Select.Item
                  className={styles.item}
                  key={node.id}
                  value={node.id}
                >
                  <Select.ItemText>
                    {node.name === '' ? node.id : node.name}
                  </Select.ItemText>
                  <Select.ItemIndicator className={styles.indicator}>
                    ✓
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Root>
        <button
          className={styles.control}
          disabled={source === undefined || chosen === undefined}
          onClick={() => {
            if (source !== undefined && chosen !== undefined) {
              connectElements(source.id, chosen.id);
            }
          }}
          type="button"
        >
          Connect
        </button>
      </section>
      <LiveRegion
        className={styles.announcement}
        label="Canvas messages"
        testId="canvas-announcement"
      >
        {announcement.message !== '' && (
          <p className={styles.message} key={announcement.sequence}>
            {announcement.message}
          </p>
        )}
      </LiveRegion>
    </div>
  );
}
