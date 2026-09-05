import { readLimits, type Divergence } from '@panoptes/formats';
import { useEffect, useRef, useState } from 'react';
import { isDirty } from '../store/selectors.js';
import { dispatch, useModelStore } from '../store/store.js';
import { FailureNotice } from '../ui/failure-notice.js';
import { browserFileBridge } from './browser-bridge.js';
import {
  OpenOutcome,
  SaveOutcome,
  type ChosenFile,
  type FileBridge,
} from './bridge.js';
import styles from './file-bar.module.css';
import {
  formatLabels,
  formatOf,
  nameOf,
  openedBy,
  otherFormat,
  reportLines,
  saveTarget,
  savedBy,
  writeThrough,
  type SaveTarget,
} from './session.js';

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

function mayDiscard(dirty: boolean): boolean {
  return (
    !dirty ||
    globalThis.confirm(
      'The model has changes that are not in a file. Open another file and lose them?',
    )
  );
}

/** Which bridge the controls reach files through. */
export type FileBarProps = { readonly bridge?: FileBridge };

/**
 * Opening and saving, the file the model lives in, whether it holds
 * everything on screen, and what the last save could not carry.
 *
 * The reducer is total and cannot refuse an open over work that is in no
 * file, so the asking is here: a person confirms once, at the control, and
 * the same unsaved state arms the guard on closing the tab. The file input
 * beside the controls is the fallback picker, hidden and reached by the same
 * Open control wherever the bridge has no picker of its own, so the
 * confirmation is asked once whichever picker follows it.
 *
 * The loss report is the divergences of the write that was just saved, which
 * is view state and not the model's: it says what one save cost rather than
 * anything about the model on screen, so it lives here and goes when the
 * next save or the next file replaces it.
 */
export function FileBar({ bridge = browserFileBridge }: FileBarProps) {
  const file = useModelStore((state) => state.file);
  const present = useModelStore((state) => state.present);
  const failure = useModelStore((state) => state.lastFailure);
  const dirty = useModelStore(isDirty);
  const [report, setReport] = useState<readonly Divergence[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useCloseGuard(dirty);

  const format = formatOf(file);
  const alternative = otherFormat(format);
  const lines = reportLines(report);

  const applyOpen = (outcome: OpenOutcome): void => {
    const action = openedBy(outcome);
    if (action !== undefined) {
      setReport([]);
      dispatch(action);
    }
  };

  const pick = async (): Promise<void> => {
    if (!mayDiscard(dirty)) {
      return;
    }
    const outcome = await bridge.open(readLimits.maxTextBytes);
    if (OpenOutcome.$is('NoPicker')(outcome)) {
      input.current?.click();
      return;
    }
    applyOpen(outcome);
  };

  const receive = async (chosen: ChosenFile | undefined): Promise<void> => {
    if (chosen !== undefined) {
      applyOpen(await bridge.received(chosen, readLimits.maxTextBytes));
    }
  };

  const store = async (
    target: SaveTarget,
    elsewhere: boolean,
  ): Promise<void> => {
    const written = writeThrough(present, target.source);
    const outcome = elsewhere
      ? await bridge.saveAs(target.name, written.output)
      : await bridge.save(target.name, written.output);
    const action = savedBy(outcome, target.source);
    if (action !== undefined) {
      dispatch(action);
    }
    if (SaveOutcome.$is('Written')(outcome)) {
      setReport(written.divergences);
    }
  };

  return (
    <div className={styles.bar}>
      <section aria-label="File" className={styles.controls}>
        <button
          className={styles.control}
          onClick={() => {
            void pick();
          }}
          type="button"
        >
          Open a model
        </button>
        <button
          className={styles.control}
          onClick={() => {
            void store(saveTarget(file, format), false);
          }}
          type="button"
        >
          Save
        </button>
        <button
          className={styles.control}
          onClick={() => {
            void store(saveTarget(file, alternative), true);
          }}
          type="button"
        >
          Save as {formatLabels[alternative]}
        </button>
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
          ref={input}
          type="file"
        />
      </section>
      <FailureNotice failure={failure} />
      <section
        aria-label="Save report"
        aria-live="polite"
        className={styles.report}
        data-testid="save-report"
      >
        {lines.length > 0 && (
          <>
            <p className={styles.headline}>
              The last save did not carry everything the model holds:
            </p>
            <ul className={styles.lines}>
              {lines.map((line, index) => (
                <li key={`${String(index)} ${line}`}>{line}</li>
              ))}
            </ul>
            <button
              className={styles.control}
              onClick={() => {
                setReport([]);
              }}
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
