import {
  readLimits,
  type FormatName,
  type WriteResult,
} from '@panoptes/formats';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { FileCommands } from '../commands/registry.js';
import { Action } from '../store/actions.js';
import { isDirty } from '../store/selectors.js';
import type { State } from '../store/state.js';
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
  formatOfName,
  formatsFrom,
  openReport,
  openedBy,
  saveReport,
  saveTarget,
  saveTypes,
  savedBy,
  writeThrough,
  type LossReport,
  type SaveTarget,
} from './session.js';

type PlannedSave = {
  readonly target: SaveTarget;
  readonly written: WriteResult;
};

/**
 * The file half of the studio, held once and read by everything that reaches
 * a file: the commands the registry dispatches, the report the last crossing
 * cost, the fallback picker's input, which the view attaches because only a
 * component can hold one, the file that input produced, and whether a close
 * is waiting to be confirmed.
 *
 * `closing` is the unsaved-changes guard as state rather than as a dialog:
 * the close command sets it, the view asks in its own words, and the answer
 * comes back through `confirmClose` or `cancelClose`. `choosing` is the
 * same shape for the format a save-as writes, which the studio asks only
 * where the platform has no picker to ask it in, `asksFormat` being where
 * that stands: it is what a control reads to know that Save as puts a
 * question rather than opening a picker. The answer comes back through
 * `chooseFormat`, or the question is taken back through `cancelChoice`.
 * Holding all of it here rather than in the view is what lets a chord ask
 * the question a menu item asks.
 */
export type FileSession = {
  readonly commands: FileCommands;
  readonly report: LossReport | undefined;
  readonly closing: boolean;
  readonly choosing: boolean;
  readonly asksFormat: boolean;
  readonly attachPicker: (input: HTMLInputElement | null) => void;
  readonly dismissReport: () => void;
  readonly receive: (chosen: ChosenFile | undefined) => Promise<void>;
  readonly confirmClose: () => void;
  readonly cancelClose: () => void;
  readonly chooseFormat: (format: FormatName) => void;
  readonly cancelChoice: () => void;
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
 * a boundary the closed file was one side of, and tells the bridge to let the
 * file go: the studio names no file after a close, so nothing may be written
 * back to the one it named.
 *
 * A save-as offers every format in the platform's own picker and writes
 * through the codec the name that comes back belongs to. Where the platform
 * has no picker to ask in, the format becomes a question the view asks in
 * its own words, the way closing asks about unsaved work, and the answer is
 * the one format the save-as then writes.
 */
export function useFileSession(
  bridge: FileBridge = browserFileBridge,
): FileSession {
  const [report, setReport] = useState<LossReport | undefined>(undefined);
  const [closing, setClosing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const picker = useRef<HTMLInputElement | null>(null);

  const attachPicker = useCallback((input: HTMLInputElement | null): void => {
    picker.current = input;
  }, []);

  const closeFile = useCallback((): void => {
    setClosing(false);
    setReport(undefined);
    bridge.release();
    dispatch(Action.Closed());
  }, [bridge]);

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

  const land = useCallback(
    (outcome: SaveOutcome, planned: PlannedSave): void => {
      const action = savedBy(outcome, planned.target.source);
      if (action !== undefined) {
        dispatch(action);
      }
      if (SaveOutcome.$is('Written')(outcome)) {
        setReport(saveReport(planned.written.divergences));
      }
    },
    [],
  );

  const chooseFormat = useCallback(
    (format: FormatName): void => {
      const settle = async (): Promise<void> => {
        setChoosing(false);
        setReport(undefined);
        const planned = planSave(modelStore.getState(), format);
        land(
          await bridge.saveAs(
            planned.target.name,
            saveTypes([format]),
            () => planned.written.output,
          ),
          planned,
        );
      };
      void settle();
    },
    [bridge, land],
  );

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

    const store = async (): Promise<void> => {
      setReport(undefined);
      const state = modelStore.getState();
      const planned = planSave(state, formatOf(state.file));
      land(
        await bridge.save(planned.target.name, planned.written.output),
        planned,
      );
    };

    const askWhere = async (): Promise<void> => {
      setReport(undefined);
      const state = modelStore.getState();
      const current = formatOf(state.file);
      let planned = planSave(state, current);
      const outcome = await bridge.saveAs(
        planned.target.name,
        saveTypes(formatsFrom(current)),
        (chosen) => {
          const format = formatOfName(chosen) ?? current;
          if (format !== planned.target.source.format) {
            planned = planSave(state, format);
          }
          return planned.written.output;
        },
      );
      land(outcome, planned);
    };

    return {
      open: () => {
        void pick();
      },
      save: () => {
        void store();
      },
      saveAs: () => {
        if (bridge.asksWhere()) {
          void askWhere();
          return;
        }
        setChoosing(true);
      },
      close: () => {
        if (isDirty(modelStore.getState())) {
          setClosing(true);
          return;
        }
        closeFile();
      },
    };
  }, [applyOpen, bridge, closeFile, land]);

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

  const cancelChoice = useCallback((): void => {
    setChoosing(false);
  }, []);

  return useMemo(
    () => ({
      commands,
      report,
      closing,
      choosing,
      asksFormat: !bridge.asksWhere(),
      attachPicker,
      dismissReport,
      receive,
      confirmClose: closeFile,
      cancelClose,
      chooseFormat,
      cancelChoice,
    }),
    [
      attachPicker,
      bridge,
      cancelChoice,
      cancelClose,
      chooseFormat,
      choosing,
      closeFile,
      closing,
      commands,
      dismissReport,
      receive,
      report,
    ],
  );
}

function planSave(state: State, format: FormatName): PlannedSave {
  const target = saveTarget(state.file, format);
  return { target, written: writeThrough(state.present, target.source) };
}

function mayDiscard(dirty: boolean): boolean {
  return (
    !dirty ||
    globalThis.confirm(
      'The model has changes that are not in a file. Open another file and lose them?',
    )
  );
}
