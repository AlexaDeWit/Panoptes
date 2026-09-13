import { severityToneClass } from '@saerskriven/canvas';
import type { Element, Threat } from '@saerskriven/model';
import { Accordion } from 'radix-ui';
import { useEffect, useId, useRef, useState } from 'react';
import { CategoryField } from '../ui/category-field.js';
import { SeverityField } from '../ui/severity-field.js';
import { StatusField } from '../ui/status-field.js';
import { ProseField, TextField, type RefusedDraft } from '../ui/text-field.js';
import styles from './threat-panel.module.css';
import {
  assumptionKind,
  mitigationKind,
  type RecordFieldName,
} from './records.js';
import { RecordGroup } from './threat-records.js';
import { elementLabel } from './threats.js';

const textFields = ['Title', 'Description', 'Mitigation'] as const;

/** Which text field of a threat, or of one of its records, a draft was typed in. */
export type TextFieldName = (typeof textFields)[number] | RecordFieldName;

/** A refused draft, and the status picked in the empty record row it was typed in, if it was typed in one. */
export type RefusedText = RefusedDraft & { readonly status?: string };

/** A refused draft with the field it was typed in, which is what puts it back. */
export type RefusedField = RefusedText & { readonly field: TextFieldName };

type Refusals = ReadonlyMap<TextFieldName, RefusedText>;

function firstRefusal(refusals: Refusals): RefusedField | undefined {
  const field =
    textFields.find((name) => refusals.has(name)) ??
    refusals.keys().next().value;
  const draft = field === undefined ? undefined : refusals.get(field);
  return field === undefined || draft === undefined
    ? undefined
    : { field, ...draft };
}

function draftIn(
  held: RefusedField | undefined,
  field: TextFieldName,
): string | undefined {
  return held?.field === field ? held.text : undefined;
}

/** Focus after adding or deleting a threat. */
export type EditorFocus = 'title' | 'disclosure';

/** A threat, its attachments, and callbacks for edits and refused drafts. */
export type ThreatEditorProps = {
  readonly threat: Threat;
  readonly attachments: readonly Element[];
  readonly focus: EditorFocus | undefined;
  readonly held: RefusedField | undefined;
  readonly onChange: () => void;
  readonly onCommit: (patch: Partial<Threat>) => void;
  readonly onRefusal: (refused: RefusedField | undefined) => void;
  readonly onDelete: () => void;
  readonly onFocused: () => void;
};

/** An expandable threat with one commit per field. */
export function ThreatEditor({
  threat,
  attachments,
  focus,
  held,
  onChange,
  onCommit,
  onRefusal,
  onDelete,
  onFocused,
}: ThreatEditorProps) {
  const titleField = useRef<HTMLInputElement>(null);
  const disclosure = useRef<HTMLButtonElement>(null);
  const spreadId = useId();
  const [refusals, setRefusals] = useState<Refusals>(new Map());
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

  const noteRefusal = (
    field: TextFieldName,
    draft: RefusedText | undefined,
  ): void => {
    const noted = new Map(refusals);
    if (draft === undefined) {
      noted.delete(field);
    } else {
      noted.set(field, draft);
    }
    if (draft !== undefined || refusals.has(field)) {
      setRefusals(noted);
    }
    onRefusal(firstRefusal(noted));
  };

  const refused =
    (field: TextFieldName) =>
    (draft: RefusedDraft | undefined): void => {
      noteRefusal(field, draft);
    };

  return (
    <Accordion.Item className={styles.item} value={threat.id}>
      <Accordion.Header className={styles.header}>
        <Accordion.Trigger className={styles.disclosure} ref={disclosure}>
          <span className={styles.number}>{threat.number}</span>
          <span className={styles.summary}>
            <span>{threat.title}</span>
            <span className={styles.metadata}>
              <span className={styles.severity}>
                <svg
                  aria-hidden="true"
                  className={styles.tone}
                  viewBox="0 0 12 12"
                >
                  <circle
                    className={severityToneClass[threat.severity]}
                    cx="6"
                    cy="6"
                    r="5"
                  />
                </svg>
                Severity: {threat.severity}
              </span>
              <span>Status: {threat.status}</span>
            </span>
          </span>
          <span aria-hidden="true" className={styles.chevron}>
            ▾
          </span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className={styles.content}>
        <TextField
          held={draftIn(held, 'Title')}
          label="Title"
          onChange={onChange}
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
        <div className={styles.assessment}>
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
        </div>
        <ProseField
          held={draftIn(held, 'Description')}
          label="Description"
          onChange={onChange}
          onCommit={(description) => {
            onCommit({ description });
          }}
          onRefused={refused('Description')}
          value={threat.description}
        />
        <ProseField
          held={draftIn(held, 'Mitigation')}
          label="Mitigation"
          onChange={onChange}
          onCommit={(mitigation) => {
            onCommit({ mitigation });
          }}
          onRefused={refused('Mitigation')}
          value={threat.mitigation}
        />
        <RecordGroup
          held={held}
          kind={mitigationKind}
          onChange={onChange}
          onRefused={noteRefusal}
          refusals={refusals}
          threatId={threat.id}
        />
        <RecordGroup
          held={held}
          kind={assumptionKind}
          onChange={onChange}
          onRefused={noteRefusal}
          refusals={refusals}
          threatId={threat.id}
        />
        {spread > 1 && (
          <div className={styles.spread}>
            <p id={spreadId}>
              This threat names {spread} elements. Deleting it takes it off all
              of them.
            </p>
            <ul aria-label="Attached elements" className={styles.attachments}>
              {attachments.map((element) => (
                <li key={element.id}>{elementLabel(element)}</li>
              ))}
            </ul>
          </div>
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
