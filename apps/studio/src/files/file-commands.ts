import { readLimits } from '@panoptes/formats';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { FileCommands } from '../commands/registry.js';
import { Action } from '../store/actions.js';
import { isDirty } from '../store/selectors.js';
import { dispatch, modelStore } from '../store/store.js';
import { browserFileBridge } from './browser-bridge.js';
import {
  OpenOutcome,
  SaveOutcome,
  type ChosenFile,
  type FileBridge,
} from './bridge.js';
import {
  formatOf,
  openReport,
  openedBy,
  otherFormat,
  saveReport,
  saveTarget,
  savedBy,
  writeThrough,
  type LossReport,
} from './session.js';

/**
 * The file half of the studio, held once and read by everything that reaches
 * a file: the commands the registry dispatches, the report the last crossing
 * cost, the fallback picker's input, which the view attaches because only a
 * component can hold one, the file that input produced, and whether a close
 * is waiting to be confirmed.
 *
 * `closing` is the unsaved-changes guard as state rather than as a dialog:
 * the close command sets it, the view asks in its own words, and the answer
 * comes back through `confirmClose` or `cancelClose`. Holding it here rather
 * than in the view is what lets the chord ask the same question the menu
 * item asks.
 */
export type FileSession = {
  readonly commands: FileCommands;
  readonly report: LossReport | undefined;
  readonly closing: boolean;
  readonly attachPicker: (input: HTMLInputElement | null) => void;
  readonly dismissReport: () => void;
  readonly receive: (chosen: ChosenFile | undefined) => Promise<void>;
  readonly confirmClose: () => void;
  readonly cancelClose: () => void;
};

/**
 * Opening, saving and closing, as one session the app holds rather than a set
 * of handlers a control closes over. The keyboard and the controls run the
 * same four commands, so a shortcut and a menu item cannot drift, and the
 * report one of them produces is the one the view beside them shows.
 *
 * Each command reads the store as it runs rather than closing over a render,
 * which is what lets the four be built once: what a save writes and where is
 * the model and the file at the moment the key was pressed.
 *
 * Closing drops the report with the file, the report describing a crossing of
 * a boundary the closed file was one side of.
 */
export function useFileSession(
  bridge: FileBridge = browserFileBridge,
): FileSession {
  const [report, setReport] = useState<LossReport | undefined>(undefined);
  const [closing, setClosing] = useState(false);
  const picker = useRef<HTMLInputElement | null>(null);

  const attachPicker = useCallback((input: HTMLInputElement | null): void => {
    picker.current = input;
  }, []);

  const closeFile = useCallback((): void => {
    setClosing(false);
    setReport(undefined);
    dispatch(Action.Closed());
  }, []);

  const applyOpen = useCallback((outcome: OpenOutcome): void => {
    const action = openedBy(outcome);
    if (action === undefined) {
      return;
    }
    if (Action.$is('Opened')(action)) {
      setReport(openReport(action.divergences));
    }
    dispatch(action);
  }, []);

  const commands = useMemo<FileCommands>(() => {
    const pick = async (): Promise<void> => {
      if (!mayDiscard(isDirty(modelStore.getState()))) {
        return;
      }
      const outcome = await bridge.open(readLimits.maxTextBytes);
      if (OpenOutcome.$is('NoPicker')(outcome)) {
        picker.current?.click();
        return;
      }
      applyOpen(outcome);
    };

    const store = async (elsewhere: boolean): Promise<void> => {
      setReport(undefined);
      const state = modelStore.getState();
      const format = formatOf(state.file);
      const target = saveTarget(
        state.file,
        elsewhere ? otherFormat(format) : format,
      );
      const written = writeThrough(state.present, target.source);
      const outcome = elsewhere
        ? await bridge.saveAs(target.name, written.output)
        : await bridge.save(target.name, written.output);
      const action = savedBy(outcome, target.source);
      if (action !== undefined) {
        dispatch(action);
      }
      if (SaveOutcome.$is('Written')(outcome)) {
        setReport(saveReport(written.divergences));
      }
    };

    return {
      open: () => {
        void pick();
      },
      save: () => {
        void store(false);
      },
      saveAs: () => {
        void store(true);
      },
      close: () => {
        if (isDirty(modelStore.getState())) {
          setClosing(true);
          return;
        }
        closeFile();
      },
    };
  }, [applyOpen, bridge, closeFile]);

  const receive = useCallback(
    async (chosen: ChosenFile | undefined): Promise<void> => {
      if (chosen !== undefined) {
        applyOpen(await bridge.received(chosen, readLimits.maxTextBytes));
      }
    },
    [applyOpen, bridge],
  );

  const dismissReport = useCallback((): void => {
    setReport(undefined);
  }, []);

  const cancelClose = useCallback((): void => {
    setClosing(false);
  }, []);

  return useMemo(
    () => ({
      commands,
      report,
      closing,
      attachPicker,
      dismissReport,
      receive,
      confirmClose: closeFile,
      cancelClose,
    }),
    [
      attachPicker,
      cancelClose,
      closeFile,
      closing,
      commands,
      dismissReport,
      receive,
      report,
    ],
  );
}

function mayDiscard(dirty: boolean): boolean {
  return (
    !dirty ||
    globalThis.confirm(
      'The model has changes that are not in a file. Open another file and lose them?',
    )
  );
}
