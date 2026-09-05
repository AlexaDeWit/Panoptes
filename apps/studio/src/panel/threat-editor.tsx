import type { Threat } from '@panoptes/model';
import { Accordion } from 'radix-ui';
import { useEffect, useId, useRef, useState } from 'react';
import { CategoryField } from '../ui/category-field.js';
import { SeverityField } from '../ui/severity-field.js';
import { StatusField } from '../ui/status-field.js';
import { ProseField, TextField } from '../ui/text-field.js';
import styles from './threat-panel.module.css';

const textFields = ['Title', 'Description', 'Mitigation'] as const;

type TextFieldName = (typeof textFields)[number];

type Refusals = Partial<Record<TextFieldName, string>>;

function firstRefusal(refusals: Refusals): string | undefined {
  const refused = textFields.find((field) => refusals[field] !== undefined);
  return refused === undefined ? undefined : refusals[refused];
}

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
  readonly onRefusal: (refusal: string | undefined) => void;
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
 * or by Tab, takes focus out of the field first, which is the commit. A
 * commit the model refuses is the exception, and every text field's refusal
 * is reported through `onRefusal` so the panel can say so and keep the item
 * open while a refused draft stands. Which field is holding one is kept here
 * rather than in the panel, so a second field committing cleanly does not
 * report the first field's draft away.
 */
export function ThreatEditor({
  threat,
  focus,
  onCommit,
  onRefusal,
  onDelete,
  onFocused,
}: ThreatEditorProps) {
  const titleField = useRef<HTMLInputElement>(null);
  const disclosure = useRef<HTMLButtonElement>(null);
  const spreadId = useId();
  const [refusals, setRefusals] = useState<Refusals>({});
  const spread = threat.elements.length;

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

  const refused =
    (field: TextFieldName) =>
    (refusal: string | undefined): void => {
      const noted: Refusals = { ...refusals, [field]: refusal };
      setRefusals(noted);
      onRefusal(firstRefusal(noted));
    };

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
          onRefused={refused('Title')}
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
          onRefused={refused('Description')}
          value={threat.description}
        />
        <ProseField
          label="Mitigation"
          onCommit={(mitigation) => {
            onCommit({ mitigation });
          }}
          onRefused={refused('Mitigation')}
          value={threat.mitigation}
        />
        {spread > 1 && (
          <p className={styles.spread} id={spreadId}>
            This threat names {spread} elements. Deleting it takes it off all of
            them.
          </p>
        )}
        <button
          aria-describedby={spread > 1 ? spreadId : undefined}
          className={styles.delete}
          onClick={onDelete}
          type="button"
        >
          Delete threat {threat.number}
        </button>
      </Accordion.Content>
    </Accordion.Item>
  );
}
