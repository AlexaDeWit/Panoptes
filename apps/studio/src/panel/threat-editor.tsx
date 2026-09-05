import type { Threat } from '@panoptes/model';
import { Accordion } from 'radix-ui';
import { useEffect, useRef } from 'react';
import { CategoryField } from '../ui/category-field.js';
import { SeverityField } from '../ui/severity-field.js';
import { StatusField } from '../ui/status-field.js';
import { ProseField, TextField } from '../ui/text-field.js';
import styles from './threat-panel.module.css';

/**
 * Which control of one threat the panel is sending focus to, and nothing
 * while it is sending none: `title` is the field an added threat opens on,
 * `disclosure` the control that expands it, which is where focus lands after
 * the threat below it was deleted.
 */
export type EditorFocus = 'title' | 'disclosure';

/** One threat in the list, what an edit does, and where focus is being sent. */
export type ThreatEditorProps = {
  readonly threat: Threat;
  readonly focus: EditorFocus | undefined;
  readonly onCommit: (patch: Partial<Threat>) => void;
  readonly onDelete: () => void;
  readonly onFocused: () => void;
};

/**
 * One threat of the list, collapsed to its number and title and expanded to
 * every field of it. Each field commits on its own: the whole threat is
 * replaced either way, and one commit is one undo step.
 *
 * Radix unmounts a collapsed item's fields, so an edit is committed before it
 * can be collapsed: reaching the control that collapses the item, by pointer
 * or by Tab, takes focus out of the field first, which is the commit.
 */
export function ThreatEditor({
  threat,
  focus,
  onCommit,
  onDelete,
  onFocused,
}: ThreatEditorProps) {
  const titleField = useRef<HTMLInputElement>(null);
  const disclosure = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focus === 'title') {
      titleField.current?.focus();
    }
    if (focus === 'disclosure') {
      disclosure.current?.focus();
    }
    if (focus !== undefined) {
      onFocused();
    }
  }, [focus, onFocused]);

  return (
    <Accordion.Item className={styles.item} value={threat.id}>
      <Accordion.Header className={styles.header}>
        <Accordion.Trigger className={styles.disclosure} ref={disclosure}>
          <span className={styles.number}>{threat.number}</span>
          <span className={styles.summary}>{threat.title}</span>
          <span aria-hidden="true" className={styles.chevron}>
            ▾
          </span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className={styles.content}>
        <TextField
          label="Title"
          onCommit={(title) => {
            onCommit({ title });
          }}
          ref={titleField}
          value={threat.title}
        />
        <CategoryField
          onCommit={(category) => {
            onCommit({ category });
          }}
          value={threat.category}
        />
        <SeverityField
          onCommit={(severity) => {
            onCommit({ severity });
          }}
          value={threat.severity}
        />
        <StatusField
          onCommit={(status) => {
            onCommit({ status });
          }}
          value={threat.status}
        />
        <ProseField
          label="Description"
          onCommit={(description) => {
            onCommit({ description });
          }}
          value={threat.description}
        />
        <ProseField
          label="Mitigation"
          onCommit={(mitigation) => {
            onCommit({ mitigation });
          }}
          value={threat.mitigation}
        />
        <button className={styles.delete} onClick={onDelete} type="button">
          Delete threat {threat.number}
        </button>
      </Accordion.Content>
    </Accordion.Item>
  );
}
