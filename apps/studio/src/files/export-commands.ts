import type { DiagramId } from '@saerskriven/model';
import {
  renderRegister,
  renderSvg,
  renderTypst,
  renderUnplacedWarning,
  type SvgDocument,
} from '@saerskriven/render';
import {
  compilePdf,
  PdfFailure,
  type PdfAssets,
} from '@saerskriven/render/pdf';
import { Either } from 'effect';
import { useCallback, useMemo, useState } from 'react';
import type { FileLifecycle } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { SaveOutcome, type FileBridge, type SaveFileType } from './bridge.js';
import { browserFileBridge } from './browser-bridge.js';
import {
  loadPdfAssets,
  PdfAssetFailure,
  type PdfAssetFailure as PdfAssetFailureType,
} from './pdf-assets.js';
import { proposedExportName } from './session.js';

type UnplacedFlow = SvgDocument['unplaced'][number];

type ExportFile = {
  readonly extension: string;
  readonly type: SaveFileType;
};

const exportFiles = {
  svg: {
    extension: '.svg',
    type: {
      description: 'SVG image',
      accept: { 'image/svg+xml': ['.svg'] },
    },
  },
  markdown: {
    extension: '.md',
    type: {
      description: 'Markdown document',
      accept: { 'text/markdown': ['.md'] },
    },
  },
  typst: {
    extension: '.typ',
    type: {
      description: 'Typst document',
      accept: { 'text/plain': ['.typ'] },
    },
  },
  pdf: {
    extension: '.pdf',
    type: {
      description: 'PDF document',
      accept: { 'application/pdf': ['.pdf'] },
    },
  },
} as const satisfies Record<string, ExportFile>;

/** The export commands offered by the File menu. */
export type ExportCommands = {
  diagram(diagramId: DiagramId): void;
  register(): void;
  typst(): void;
  pdf(): void;
};

/** A report from the last export, announced beside the File menu. */
export type ExportNotice = {
  readonly headline: string;
  readonly details: readonly string[];
};

/** Browser services the PDF export needs, replaceable by a focused spec. */
export type PdfExport = {
  readonly assets: () => Promise<Either.Either<PdfAssets, PdfAssetFailureType>>;
  readonly compile: typeof compilePdf;
};

/** The PDF services used by the browser application. */
export const browserPdfExport: PdfExport = {
  assets: loadPdfAssets,
  compile: compilePdf,
};

/** One set of export commands and the report their last run produced. */
export function useExportCommands(
  bridge: FileBridge = browserFileBridge,
  pdf: PdfExport = browserPdfExport,
): {
  readonly commands: ExportCommands;
  readonly notice: ExportNotice | undefined;
  readonly dismissNotice: () => void;
} {
  const [notice, setNotice] = useState<ExportNotice | undefined>(undefined);

  const place = useCallback(
    async (
      sourceFile: FileLifecycle,
      file: ExportFile,
      content: string | Blob,
      unplaced: readonly UnplacedFlow[] = [],
    ): Promise<void> => {
      const outcome = await bridge.exportFile(
        proposedExportName(sourceFile, file.extension),
        file.type,
        content,
      );
      setNotice(noticeFrom(outcome, unplaced));
    },
    [bridge],
  );

  const commands = useMemo<ExportCommands>(
    () => ({
      diagram: (diagramId) => {
        const state = modelStore.getState();
        const diagram = state.present.diagrams.find(
          (candidate) => candidate.id === diagramId,
        );
        if (diagram === undefined) {
          return;
        }
        const projection = renderSvg(diagram, state.present);
        void place(
          state.file,
          exportFiles.svg,
          projection.svg,
          projection.unplaced,
        );
      },
      register: () => {
        const state = modelStore.getState();
        void place(
          state.file,
          exportFiles.markdown,
          renderRegister(state.present),
        );
      },
      typst: () => {
        const state = modelStore.getState();
        const projection = renderTypst(state.present);
        void place(
          state.file,
          exportFiles.typst,
          projection.typst,
          projection.unplaced,
        );
      },
      pdf: () => {
        const run = async (): Promise<void> => {
          setNotice(undefined);
          const state = modelStore.getState();
          const projection = renderTypst(state.present);
          const assets = await pdf.assets();
          if (Either.isLeft(assets)) {
            setNotice(assetNotice(assets.left));
            return;
          }
          const compiled = await pdf.compile(projection.typst, assets.right);
          if (Either.isLeft(compiled)) {
            setNotice(compileNotice(compiled.left));
            return;
          }
          await place(
            state.file,
            exportFiles.pdf,
            new Blob([new Uint8Array(compiled.right)], {
              type: 'application/pdf',
            }),
            projection.unplaced,
          );
        };
        void run();
      },
    }),
    [pdf, place],
  );

  const dismissNotice = useCallback((): void => {
    setNotice(undefined);
  }, []);

  return useMemo(
    () => ({ commands, notice, dismissNotice }),
    [commands, dismissNotice, notice],
  );
}

function noticeFrom(
  outcome: SaveOutcome,
  unplaced: readonly UnplacedFlow[],
): ExportNotice | undefined {
  return SaveOutcome.$match(outcome, {
    Written: () => unplacedNotice(unplaced),
    Cancelled: () => undefined,
    Refused: ({ reason }) => ({
      headline: 'Saerskriven could not write the export.',
      details: [reason],
    }),
  });
}

function unplacedNotice(
  unplaced: readonly UnplacedFlow[],
): ExportNotice | undefined {
  const [headline, ...details] = renderUnplacedWarning(unplaced)
    .trimEnd()
    .split('\n');
  return headline === ''
    ? undefined
    : { headline, details: details.map((line) => line.trim()) };
}

function assetNotice(failure: PdfAssetFailureType): ExportNotice {
  return PdfAssetFailure.$match(failure, {
    Unavailable: ({ reason }) => ({
      headline: 'Saerskriven could not load the PDF compiler.',
      details: [reason],
    }),
  });
}

function compileNotice(failure: PdfFailure): ExportNotice {
  return PdfFailure.$match(failure, {
    Refused: ({ sentences }) => ({
      headline: 'Saerskriven could not compile the PDF.',
      details: sentences,
    }),
    NoDocument: () => ({
      headline: 'The Typst compiler produced no PDF.',
      details: [],
    }),
  });
}
