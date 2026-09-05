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
 * component can hold one, and the file that input produced.
 */
export type FileSession = {
  readonly commands: FileCommands;
  readonly report: LossReport | undefined;
  readonly attachPicker: (input: HTMLInputElement | null) => void;
  readonly dismissReport: () => void;
  readonly receive: (chosen: ChosenFile | undefined) => Promise<void>;
};

/**
 * Opening and saving, as one session the app holds rather than a set of
 * handlers a control closes over. The keyboard and the controls run the same
 * three commands, so a shortcut and a button cannot drift, and the report
 * one of them produces is the one the view beside them shows.
 *
 * Each command reads the store as it runs rather than closing over a render,
 * which is what lets the three be built once: what a save writes and where
 * is the model and the file at the moment the key was pressed.
 */
export function useFileSession(
  bridge: FileBridge = browserFileBridge,
): FileSession {
  const [report, setReport] = useState<LossReport | undefined>(undefined);
  const picker = useRef<HTMLInputElement | null>(null);

  const attachPicker = useCallback((input: HTMLInputElement | null): void => {
    picker.current = input;
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
    };
  }, [applyOpen, bridge]);

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

  return useMemo(
    () => ({ commands, report, attachPicker, dismissReport, receive }),
    [attachPicker, commands, dismissReport, receive, report],
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
