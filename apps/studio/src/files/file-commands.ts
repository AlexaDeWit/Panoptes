import {
  readLimits,
  type FormatName,
  type WriteResult,
} from '@saerskriven/formats';
import { Either } from 'effect';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FileCommands } from '../commands/registry.js';
import { Action } from '../store/actions.js';
import { isDirty } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { browserStoreSync, type StoreSync } from '../store/sync.js';
import { browserFileBridge } from './browser-bridge.js';
import {
  browserRenderExports,
  useExportCommands,
  type ExportNotice,
  type RenderExports,
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
  type ReadIntent,
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
  readonly opening: boolean;
  readonly importing: boolean;
  readonly confirmImport: () => void;
  readonly cancelImport: () => void;
  readonly closing: boolean;
  readonly choosing: boolean;
  readonly asksFormat: boolean;
  readonly exportNotice: ExportNotice | undefined;
  readonly attachPicker: (input: HTMLInputElement | null) => void;
  readonly dismissReport: () => void;
  readonly dismissExportNotice: () => void;
  readonly receive: (chosen: ChosenFile | undefined) => Promise<void>;
  readonly confirmOpen: () => void;
  readonly cancelOpen: () => void;
  readonly confirmClose: () => void;
  readonly cancelClose: () => void;
  readonly chooseFormat: (format: FormatName) => void;
  readonly cancelChoice: () => void;
};

/**
 * Settles handle ownership before synchronously dispatching the matching
 * store action for an open or a save. The session is also what follows other
 * tabs, since a model another tab wrote is one the held handle does not
 * describe: a follow releases the handle and puts away the report and every
 * question.
 */
export function useFileSession(
  bridge: FileBridge = browserFileBridge,
  renders: RenderExports = browserRenderExports,
  sync: Pick<StoreSync, 'watch'> = browserStoreSync,
): FileSession {
  const [report, setReport] = useState<LossReport | undefined>(undefined);
  const [opening, setOpening] = useState(false);
  const [importing, setImporting] = useState(false);
  const pickerIntent = useRef<ReadIntent>('open');
  const [closing, setClosing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const picker = useRef<HTMLInputElement | null>(null);
  const exporter = useExportCommands(bridge, renders);
  const exportCommands = exporter.commands;

  const attachPicker = useCallback((input: HTMLInputElement | null): void => {
    picker.current = input;
  }, []);

  useEffect(
    () =>
      sync.watch((state) => {
        dispatch(Action.Followed({ state }));
        bridge.release();
        setReport(undefined);
        setOpening(false);
        setImporting(false);
        setClosing(false);
        setChoosing(false);
      }),
    [bridge, sync],
  );

  const closeFile = useCallback((): void => {
    setClosing(false);
    setReport(undefined);
    if (Either.isRight(dispatch(Action.Closed()))) {
      bridge.release();
    }
  }, [bridge]);

  const applyOpen = useCallback(
    (result: FileResult<OpenOutcome>, intent: ReadIntent): void => {
      const action = openedBy(result.outcome, intent);
      if (action === undefined) {
        result.settle('unchanged');
        return;
      }
      const imported = Action.$is('Imported')(action);
      const opened = Action.$is('Opened')(action);
      const disposition =
        intent === 'import' ? (imported ? false : 'unchanged') : opened;
      if (!result.settle(disposition)) return;
      dispatch(action);
      if (Action.$is('Opened')(action) || Action.$is('Imported')(action)) {
        setReport(openReport(action.divergences, intent));
      }
    },
    [],
  );

  const openFile = useCallback(
    async (intent: ReadIntent = 'open'): Promise<void> => {
      setOpening(false);
      setImporting(false);
      const result = await bridge.open(readLimits.maxTextBytes);
      if (OpenOutcome.$is('NoPicker')(result.outcome)) {
        if (result.settle('unchanged')) {
          pickerIntent.current = intent;
          picker.current?.click();
        }
        return;
      }
      applyOpen(result, intent);
    },
    [applyOpen, bridge],
  );

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
        if (isDirty(modelStore.getState())) {
          setOpening(true);
          return;
        }
        void openFile();
      },
      import: () => {
        if (isDirty(modelStore.getState())) {
          setImporting(true);
          return;
        }
        void openFile('import');
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
      exportPng: () => {
        exportCommands.png();
      },
      close: () => {
        if (isDirty(modelStore.getState())) {
          setClosing(true);
          return;
        }
        closeFile();
      },
    };
  }, [bridge, closeFile, exportCommands, land, openFile]);

  const receive = useCallback(
    async (chosen: ChosenFile | undefined): Promise<void> => {
      if (chosen !== undefined) {
        const intent = pickerIntent.current;
        applyOpen(
          await bridge.received(chosen, readLimits.maxTextBytes),
          intent,
        );
      }
    },
    [applyOpen, bridge],
  );

  const dismissReport = useCallback((): void => {
    setReport(undefined);
  }, []);

  const cancelOpen = useCallback((): void => {
    setOpening(false);
  }, []);

  const cancelImport = useCallback((): void => {
    setImporting(false);
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
      opening,
      importing,
      confirmImport: () => {
        void openFile('import');
      },
      cancelImport,
      closing,
      choosing,
      asksFormat: !bridge.asksWhere(),
      exportNotice: exporter.notice,
      attachPicker,
      dismissReport,
      dismissExportNotice: exporter.dismissNotice,
      receive,
      confirmOpen: () => {
        void openFile();
      },
      cancelOpen,
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
      cancelOpen,
      cancelImport,
      importing,
      chooseFormat,
      choosing,
      closeFile,
      closing,
      commands,
      dismissReport,
      exporter,
      opening,
      openFile,
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
