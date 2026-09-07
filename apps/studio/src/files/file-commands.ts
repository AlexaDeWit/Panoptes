import {
  readLimits,
  type FormatName,
  type WriteResult,
} from '@saerskriven/formats';
import { Either } from 'effect';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { FileCommands } from '../commands/registry.js';
import { Action } from '../store/actions.js';
import { isDirty } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { browserFileBridge } from './browser-bridge.js';
import {
  browserPdfExport,
  useExportCommands,
  type ExportNotice,
  type PdfExport,
} from './export-commands.js';
import {
  OpenOutcome,
  SaveOutcome,
  type ChosenFile,
  type FileBridge,
  type FileResult,
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

/** File commands, export commands, notices, and menu questions. */
export type FileSession = {
  readonly commands: FileCommands;
  readonly report: LossReport | undefined;
  readonly closing: boolean;
  readonly choosing: boolean;
  readonly asksFormat: boolean;
  readonly exportNotice: ExportNotice | undefined;
  readonly attachPicker: (input: HTMLInputElement | null) => void;
  readonly dismissReport: () => void;
  readonly dismissExportNotice: () => void;
  readonly receive: (chosen: ChosenFile | undefined) => Promise<void>;
  readonly confirmClose: () => void;
  readonly cancelClose: () => void;
  readonly chooseFormat: (format: FormatName) => void;
  readonly cancelChoice: () => void;
};

/** Settles handle ownership before synchronously dispatching the matching store action. */
export function useFileSession(
  bridge: FileBridge = browserFileBridge,
  pdf: PdfExport = browserPdfExport,
): FileSession {
  const [report, setReport] = useState<LossReport | undefined>(undefined);
  const [closing, setClosing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const picker = useRef<HTMLInputElement | null>(null);
  const exporter = useExportCommands(bridge, pdf);
  const exportCommands = exporter.commands;

  const attachPicker = useCallback((input: HTMLInputElement | null): void => {
    picker.current = input;
  }, []);

  const closeFile = useCallback((): void => {
    setClosing(false);
    setReport(undefined);
    if (Either.isRight(dispatch(Action.Closed()))) {
      bridge.release();
    }
  }, [bridge]);

  const applyOpen = useCallback((result: FileResult<OpenOutcome>): void => {
    const action = openedBy(result.outcome);
    if (action === undefined || !result.settle(Action.$is('Opened')(action))) {
      return;
    }
    dispatch(action);
    if (Action.$is('Opened')(action)) {
      setReport(openReport(action.divergences));
    }
  }, []);

  const land = useCallback(
    (result: FileResult<SaveOutcome>, planned: PlannedSave): void => {
      const action = savedBy(result.outcome, planned.target.source);
      if (action === undefined || !result.settle(true)) {
        return;
      }
      dispatch(action);
      if (SaveOutcome.$is('Written')(result.outcome)) {
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
      const result = await bridge.open(readLimits.maxTextBytes);
      if (OpenOutcome.$is('NoPicker')(result.outcome)) {
        if (result.settle(true)) {
          picker.current?.click();
        }
        return;
      }
      applyOpen(result);
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
      exportDiagram: (diagramId) => {
        exportCommands.diagram(diagramId);
      },
      exportRegister: () => {
        exportCommands.register();
      },
      exportTypst: () => {
        exportCommands.typst();
      },
      exportPdf: () => {
        exportCommands.pdf();
      },
      close: () => {
        if (isDirty(modelStore.getState())) {
          setClosing(true);
          return;
        }
        closeFile();
      },
    };
  }, [applyOpen, bridge, closeFile, exportCommands, land]);

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
      exportNotice: exporter.notice,
      attachPicker,
      dismissReport,
      dismissExportNotice: exporter.dismissNotice,
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
      exporter,
      receive,
      report,
    ],
  );
}

function planSave(state: State, format: FormatName): PlannedSave {
  const target = saveTarget(state.file, format);
  return {
    target,
    written: writeThrough(state.present, target.source),
  };
}

function mayDiscard(dirty: boolean): boolean {
  return (
    !dirty ||
    globalThis.confirm(
      'The model has changes that are not in a file. Open another file and lose them?',
    )
  );
}
