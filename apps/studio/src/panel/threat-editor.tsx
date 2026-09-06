import type { Threat } from '@saerskriven/model';
import { Accordion } from 'radix-ui';
import { useEffect, useId, useRef, useState } from 'react';
import { CategoryField } from '../ui/category-field.js';
import { SeverityField } from '../ui/severity-field.js';
import { StatusField } from '../ui/status-field.js';
import { ProseField, TextField, type RefusedDraft } from '../ui/text-field.js';
import styles from './threat-panel.module.css';

const textFields = ['Title', 'Description', 'Mitigation'] as const;

/** Which text field of a threat a draft was typed in. */
export type TextFieldName = (typeof textFields)[number];

/** A refused draft with the field it was typed in, which is what puts it back. */
export type RefusedField = RefusedDraft & { readonly field: TextFieldName };

type Refusals = Partial<Record<TextFieldName, RefusedDraft>>;

function firstRefusal(refusals: Refusals): RefusedField | undefined {
  for (const field of textFields) {
    const draft = refusals[field];
    if (draft !== undefined) {
      return { field, ...draft };
    }
  }
  return undefined;
}

function draftIn(
  held: RefusedField | undefined,
  field: TextFieldName,
): string | undefined {
  return held?.field === field ? held.text : undefined;
}

/**
 * Which control of one threat the panel is sending focus to, and nothing
 * while it is sending none: `title` is the field an added threat opens on,
 * `disclosure` the control that expands it, which is where focus lands after
 * the threat below it was deleted.
 */
export type EditorFocus = 'title' | 'disclosure';

/**
 * One threat in the list, what an edit does, where focus is being sent, and
 * the draft the model refused the last time this threat was on screen, which
 * the field it was typed in opens on.
 */
export type ThreatEditorProps = {
  readonly threat: Threat;
  readonly focus: EditorFocus | undefined;
  readonly held: RefusedField | undefined;
  readonly onCommit: (patch: Partial<Threat>) => void;
  readonly onRefusal: (refused: RefusedField | undefined) => void;
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
 * is reported through `onRefusal`, with the text and the field it was typed
 * in, so the panel can say so, keep the item open while a refused draft
 * stands, and hand the draft back through `held` the next time this threat is
 * drawn. Which field is holding one is kept here rather than in the panel, so
 * a second field committing cleanly does not report the first field's draft
 * away.
 */
export function ThreatEditor({
  threat,
  focus,
  held,
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
    (draft: RefusedDraft | undefined): void => {
      const noted: Refusals = { ...refusals, [field]: draft };
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
          held={draftIn(held, 'Title')}
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
          held={draftIn(held, 'Description')}
          label="Description"
          onCommit={(description) => {
            onCommit({ description });
          }}
          onRefused={refused('Description')}
          value={threat.description}
        />
        <ProseField
          held={draftIn(held, 'Mitigation')}
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
