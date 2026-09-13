import { firstRefusedCharacter, isEmptyName } from '@saerskriven/model';
import { useEffect, useId, useRef, useState, type Ref } from 'react';

import styles from './text-field.module.css';

type Draft = { readonly shown: string; readonly text: string };

/** State and validation shared by the studio's controlled text editors. */
export function useTextDraft(
  label: string,
  value: string,
  held: string | undefined,
  onCommit: (text: string) => void,
  onRefused: (refused: RefusedDraft | undefined) => void,
  refuse: (
    label: string,
    text: string,
  ) => TextRefusal | undefined = refusedText,
): {
  readonly text: string;
  readonly refusal: TextRefusal | undefined;
  readonly change: (text: string) => void;
  readonly commit: () => boolean;
} {
  const [draft, setDraft] = useState<Draft>({
    shown: value,
    text: held ?? value,
  });
  const [refusal, setRefusal] = useState<TextRefusal | undefined>(() =>
    held === undefined ? undefined : refuse(label, held),
  );
  const reported = useRef<TextRefusal | undefined>(undefined);

  if (draft.shown !== value) {
    setDraft({ shown: value, text: value });
    setRefusal(undefined);
  }

  useEffect(() => {
    if (reported.current !== refusal) {
      reported.current = refusal;
      onRefused(
        refusal === undefined
          ? undefined
          : { said: refusal.said, text: draft.text },
      );
    }
  }, [draft.text, refusal, onRefused]);

  return {
    text: draft.text,
    refusal,
    change: (text) => {
      setDraft({ shown: value, text });
    },
    commit: () => {
      const refused = refuse(label, draft.text);
      setRefusal(refused);
      if (refused === undefined) {
        onCommit(draft.text);
        return true;
      }
      return false;
    },
  };
}

/** Inline and announced forms of a validation refusal. */
export type TextRefusal = {
  readonly shown: string;
  readonly said: string;
};

/** The refused text and its announcement, retained when the editor unmounts. */
export type RefusedDraft = {
  readonly said: string;
  readonly text: string;
};

/** Identifies the first character the model refuses. */
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

const emptyRefusal = 'A name cannot be empty.';

/** Refuses an empty name ahead of the characters {@link refusedText} refuses. */
export function refusedName(
  label: string,
  text: string,
): TextRefusal | undefined {
  return isEmptyName(text)
    ? { shown: emptyRefusal, said: `${label} was not saved. ${emptyRefusal}` }
    : refusedText(label, text);
}

/** A controlled value, an optional refused draft, and callbacks for changes and commits. */
export type TextFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly held?: string;
  readonly onChange?: () => void;
  readonly onCommit: (text: string) => void;
  readonly onRefused: (refused: RefusedDraft | undefined) => void;
  readonly ref?: Ref<HTMLInputElement>;
};

/** Commits a single line on blur or Enter, keeping each edit as one undo step. */
export function TextField({
  label,
  value,
  held,
  onChange,
  onCommit,
  onRefused,
  ref,
}: TextFieldProps) {
  const fieldId = useId();
  const refusalId = useId();
  const { text, refusal, change, commit } = useTextDraft(
    label,
    value,
    held,
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
          onChange?.();
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

/** A {@link TextFieldProps} for prose, which starts at three lines rather than eight when `compact`. */
export type ProseFieldProps = Omit<TextFieldProps, 'ref'> & {
  readonly compact?: boolean;
};

/** Edits Markdown source and commits on blur. The textarea grows with content and supports vertical resizing. */
export function ProseField({
  label,
  value,
  held,
  compact = false,
  onChange,
  onCommit,
  onRefused,
}: ProseFieldProps) {
  const fieldId = useId();
  const refusalId = useId();
  const { text, refusal, change, commit } = useTextDraft(
    label,
    value,
    held,
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
        className={compact ? `${styles.prose} ${styles.compact}` : styles.prose}
        id={fieldId}
        onBlur={commit}
        onChange={(event) => {
          onChange?.();
          change(event.target.value);
        }}
        rows={compact ? 3 : 8}
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
