import { firstRefusedCharacter } from '@panoptes/model';
import { useId, useState, type Ref } from 'react';

import styles from './text-field.module.css';

type Draft = { readonly shown: string; readonly text: string };

function useDraft(
  value: string,
  onCommit: (text: string) => void,
): {
  readonly text: string;
  readonly refusal: string | undefined;
  readonly change: (text: string) => void;
  readonly commit: () => void;
} {
  const [draft, setDraft] = useState<Draft>({ shown: value, text: value });
  const [refusal, setRefusal] = useState<string | undefined>(undefined);

  if (draft.shown !== value) {
    setDraft({ shown: value, text: value });
    setRefusal(undefined);
  }

  return {
    text: draft.text,
    refusal,
    change: (text) => {
      setDraft({ shown: value, text });
    },
    commit: () => {
      const message = refusedText(draft.text);
      setRefusal(message);
      if (message === undefined) {
        onCommit(draft.text);
      }
    },
  };
}

/**
 * Why the model would not take this text, or nothing for text it accepts.
 * Every string of the model is text of a defined character set, and a paste
 * is where a character outside it arrives, so the field says which character
 * stopped the edit rather than letting the model carry text no codec can
 * write back out.
 */
export function refusedText(text: string): string | undefined {
  const at = firstRefusedCharacter(text);
  return at === undefined
    ? undefined
    : `Character ${String(at + 1)} is one the model does not accept.`;
}

/** What a {@link TextField} or {@link ProseField} shows and where an edit goes. */
export type TextFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly onCommit: (text: string) => void;
  readonly ref?: Ref<HTMLInputElement>;
};

/**
 * One line of text, committed when the field is left rather than as it is
 * typed, so one edit is one undo step. Enter commits it too, and leaves focus
 * where it is, the control being on a line of its own.
 *
 * What is typed is the field's until it is committed, which is what keeps a
 * refused character on screen to be corrected. An edit that lands from
 * anywhere else, an undo among them, replaces it: the field follows the value
 * it is given whenever that value moves.
 */
export function TextField({ label, value, onCommit, ref }: TextFieldProps) {
  const fieldId = useId();
  const refusalId = useId();
  const { text, refusal, change, commit } = useDraft(value, onCommit);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <input
        aria-describedby={refusal === undefined ? undefined : refusalId}
        aria-invalid={refusal !== undefined}
        className={styles.input}
        id={fieldId}
        onBlur={commit}
        onChange={(event) => {
          change(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
        ref={ref}
        type="text"
        value={text}
      />
      {refusal !== undefined && (
        <p className={styles.refusal} id={refusalId}>
          {refusal}
        </p>
      )}
    </div>
  );
}

/**
 * Markdown prose, committed on the same terms as {@link TextField}. Enter
 * belongs to the text here, so leaving the field is the only commit. It is
 * the markdown source and nothing else: a preview beside it is deferred, and
 * the panel's README says why.
 */
export function ProseField({ label, value, onCommit }: TextFieldProps) {
  const fieldId = useId();
  const refusalId = useId();
  const { text, refusal, change, commit } = useDraft(value, onCommit);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <textarea
        aria-describedby={refusal === undefined ? undefined : refusalId}
        aria-invalid={refusal !== undefined}
        className={styles.prose}
        id={fieldId}
        onBlur={commit}
        onChange={(event) => {
          change(event.target.value);
        }}
        rows={4}
        value={text}
      />
      {refusal !== undefined && (
        <p className={styles.refusal} id={refusalId}>
          {refusal}
        </p>
      )}
    </div>
  );
}
