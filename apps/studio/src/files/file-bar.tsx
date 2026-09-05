import { useEffect } from 'react';
import { CommandButton } from '../commands/command-button.js';
import { isDirty } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import { FailureNotice } from '../ui/failure-notice.js';
import type { FileSession } from './file-commands.js';
import styles from './file-bar.module.css';
import {
  formatLabels,
  formatOf,
  nameOf,
  otherFormat,
  reportHeadlines,
  reportLines,
} from './session.js';

/** The session the controls read and run their commands through. */
export type FileBarProps = { readonly session: FileSession };

/**
 * Opening and saving, the file the model lives in, whether it holds
 * everything on screen, and what the last save could not carry.
 *
 * The three controls are the registry's commands ([the
 * commands](../commands/README.md)), so each shows the chord that runs the
 * same thing from the keyboard and neither route holds a handler of its own.
 * What they run is the session the app holds ([the session
 * hook](./file-commands.ts)), which is where the confirmation over unsaved
 * work is asked: the reducer is total and cannot refuse an open. The same
 * unsaved state arms the guard on closing the tab, which is here because a
 * component is what can hold it.
 *
 * The file input beside the controls is the fallback picker, hidden and
 * reached by the Open command wherever the bridge has no picker of its own,
 * so the confirmation is asked once whichever picker follows it.
 *
 * The loss report is what the last open or the last save cost, which is view
 * state and not the model's: it says what one file crossing cost rather than
 * anything about the model on screen, so it stands until a save starts or an
 * open lands. An open that was refused leaves it alone, nothing having
 * crossed the file boundary. A read reports as a write does, because the keys
 * a wire schema does not declare are gone from the model and from the
 * retained document alike, so no later save can say what became of them.
 */
export function FileBar({ session }: FileBarProps) {
  const file = useModelStore((state) => state.file);
  const failure = useModelStore((state) => state.lastFailure);
  const dirty = useModelStore(isDirty);

  useCloseGuard(dirty);

  const { attachPicker, dismissReport, receive, report } = session;
  const format = formatOf(file);
  const alternative = otherFormat(format);

  return (
    <div className={styles.bar}>
      <section aria-label="File" className={styles.controls}>
        <CommandButton className={styles.control} command="open" />
        <CommandButton className={styles.control} command="save" />
        <CommandButton className={styles.control} command="save-as">
          Save as {formatLabels[alternative]}
        </CommandButton>
        <p className={styles.state} data-testid="file-state">
          {nameOf(file)}, {formatLabels[format]},{' '}
          {dirty ? 'unsaved changes' : 'no unsaved changes'}
        </p>
        <input
          className={styles.input}
          data-testid="file-input"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            event.target.value = '';
            void receive(chosen);
          }}
          ref={attachPicker}
          type="file"
        />
      </section>
      <FailureNotice failure={failure} />
      <section
        aria-label="Loss report"
        aria-live="polite"
        className={styles.report}
        data-testid="loss-report"
      >
        {report !== undefined && (
          <>
            <p className={styles.headline}>
              {reportHeadlines[report.occasion]}
            </p>
            <ul className={styles.lines}>
              {reportLines(report.divergences).map((line, index) => (
                <li key={`${String(index)} ${line}`}>{line}</li>
              ))}
            </ul>
            <button
              className={styles.control}
              onClick={dismissReport}
              type="button"
            >
              Dismiss the report
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function useCloseGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) {
      return undefined;
    }
    const guard = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    globalThis.addEventListener('beforeunload', guard);
    return () => {
      globalThis.removeEventListener('beforeunload', guard);
    };
  }, [dirty]);
}
