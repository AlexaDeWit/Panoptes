import { firstRefusedCharacter } from '@panoptes/model';
import { useEffect, useId, useRef, useState, type Ref } from 'react';

import styles from './text-field.module.css';

type Draft = { readonly shown: string; readonly text: string };

function useDraft(
  label: string,
  value: string,
  onCommit: (text: string) => void,
  onRefused: (refusal: string | undefined) => void,
): {
  readonly text: string;
  readonly refusal: TextRefusal | undefined;
  readonly change: (text: string) => void;
  readonly commit: () => void;
} {
  const [draft, setDraft] = useState<Draft>({ shown: value, text: value });
  const [refusal, setRefusal] = useState<TextRefusal | undefined>(undefined);
  const reported = useRef<TextRefusal | undefined>(undefined);

  if (draft.shown !== value) {
    setDraft({ shown: value, text: value });
    setRefusal(undefined);
  }

  useEffect(() => {
    if (reported.current !== refusal) {
      reported.current = refusal;
      onRefused(refusal?.said);
    }
  }, [refusal, onRefused]);

  return {
    text: draft.text,
    refusal,
    change: (text) => {
      setDraft({ shown: value, text });
    },
    commit: () => {
      const refused = refusedText(label, draft.text);
      setRefusal(refused);
      if (refused === undefined) {
        onCommit(draft.text);
      }
    },
  };
}

/**
 * A refusal in the two places it is read: `shown` under the field, where the
 * label already says which field it is, and `said` wherever the refusal is
 * announced away from it, where the field has to be named.
 */
export type TextRefusal = {
  readonly shown: string;
  readonly said: string;
};

/**
 * Why the model would not take this text, or nothing for text it accepts.
 * Every string of the model is text of a defined character set, and a paste
 * is where a character outside it arrives, so the field says which character
 * stopped the edit rather than letting the model carry text no codec can
 * write back out.
 *
 * The position is counted in characters, not in the code units the model
 * reports the refusal at, so an emoji earlier in the text does not shift the
 * number a person counts to.
 */
export function refusedText(
  label: string,
  text: string,
): TextRefusal | undefined {
  const at = firstRefusedCharacter(text);
  if (at === undefined) {
    return undefined;
  }
  const before = Array.from(text.slice(0, at)).length;
  const shown = `Character ${String(before + 1)} is one the model does not accept.`;
  return { shown, said: `${label} was not saved. ${shown}` };
}

/** What a {@link TextField} or {@link ProseField} shows and where an edit goes. */
export type TextFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly onCommit: (text: string) => void;
  readonly onRefused: (refusal: string | undefined) => void;
  readonly ref?: Ref<HTMLInputElement>;
};

/**
 * One line of text, committed when the field is left rather than as it is
 * typed, so one edit is one undo step. Enter commits it too, and leaves focus
 * where it is, the control being on a line of its own.
 *
 * What is typed is the field's until it is committed, which is what keeps a
 * refused character on screen to be corrected. Every change to whether the
 * model is refusing the draft reaches `onRefused`, so what mounts the field
 * can say so and keep the field on screen while a refused draft stands. It is
 * reported after the render rather than during it, because the field's own
 * refusal drops during render, when the value it is given moves, and a parent
 * cannot take a report from a child that is still rendering.
 *
 * An edit that lands from anywhere else, an undo among them, replaces the
 * draft: the field follows the value it is given whenever that value moves.
 */
export function TextField({
  label,
  value,
  onCommit,
  onRefused,
  ref,
}: TextFieldProps) {
  const fieldId = useId();
  const refusalId = useId();
  const { text, refusal, change, commit } = useDraft(
    label,
    value,
    onCommit,
    onRefused,
  );

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
          {refusal.shown}
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
export function ProseField({
  label,
  value,
  onCommit,
  onRefused,
}: TextFieldProps) {
  const fieldId = useId();
  const refusalId = useId();
  const { text, refusal, change, commit } = useDraft(
    label,
    value,
    onCommit,
    onRefused,
  );

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
          {refusal.shown}
        </p>
      )}
    </div>
  );
}
