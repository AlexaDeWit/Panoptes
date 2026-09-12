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
import {
  renderPng,
  ResvgFailure,
  type PngImage,
} from '@saerskriven/render/png';
import type { ResvgAssets } from '@saerskriven/render/resvg';
import { Either } from 'effect';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { activeDiagram } from '../store/selectors.js';
import type { FileLifecycle, State } from '../store/state.js';
import { modelStore, onCanvasOrPanelChange } from '../store/store.js';
import { SaveOutcome, type FileBridge, type SaveFileType } from './bridge.js';
import { browserFileBridge } from './browser-bridge.js';
import {
  loadPdfAssets,
  loadPngAssets,
  RenderAssetFailure,
  type RenderAssetFailure as RenderAssetFailureType,
} from './render-assets.js';
import { proposedExportName } from './session.js';

type UnplacedFlow = SvgDocument['unplaced'][number];

type ExportFile = {
  readonly extension: string;
  readonly type: SaveFileType;
};

type Produced = {
  readonly content: Uint8Array;
  readonly unplaced: readonly UnplacedFlow[];
};

const exportFiles = {
  svg: {
    extension: '.svg',
    type: {
      description: 'SVG image',
      accept: { 'image/svg+xml': ['.svg'] },
    },
  },
  png: {
    extension: '.png',
    type: {
      description: 'PNG image',
      accept: { 'image/png': ['.png'] },
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
  diagram(diagramId?: DiagramId): void;
  register(): void;
  typst(): void;
  pdf(): void;
  png(): void;
};

/**
 * A report from the last export, announced beside the File menu. `refusal`
 * decides its lifetime: a refusal is a problem and stands until the person
 * dismisses it or a later export replaces it, while an informational report
 * of an export that was written goes at the next canvas or panel change.
 */
export type ExportNotice = {
  readonly headline: string;
  readonly details: readonly string[];
  readonly refusal: boolean;
};

/**
 * Browser services the two exports that read WebAssembly need, replaceable by
 * a focused spec: the bytes each one runs on, and the projection that reads
 * them.
 */
export type RenderExports = {
  readonly pdfAssets: () => Promise<
    Either.Either<PdfAssets, RenderAssetFailureType>
  >;
  readonly compile: typeof compilePdf;
  readonly pngAssets: () => Promise<
    Either.Either<ResvgAssets, RenderAssetFailureType>
  >;
  readonly draw: typeof renderPng;
};

/** The PDF and PNG services used by the browser application. */
export const browserRenderExports: RenderExports = {
  pdfAssets: loadPdfAssets,
  compile: compilePdf,
  pngAssets: loadPngAssets,
  draw: renderPng,
};

/**
 * One set of export commands and the report their last run produced. The
 * report stands until the person dismisses it or the next action that moves
 * canvas or panel state, never on a timer.
 */
export function useExportCommands(
  bridge: FileBridge = browserFileBridge,
  renders: RenderExports = browserRenderExports,
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
      content: string | Uint8Array,
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

  const produce = useCallback(
    (
      file: ExportFile,
      make: (
        state: State,
      ) => Promise<Either.Either<Produced, ExportNotice> | undefined>,
    ): void => {
      const run = async (): Promise<void> => {
        setNotice(undefined);
        const state = modelStore.getState();
        const made = await make(state);
        if (made === undefined) {
          return;
        }
        if (Either.isLeft(made)) {
          setNotice(made.left);
          return;
        }
        await place(state.file, file, made.right.content, made.right.unplaced);
      };
      void run();
    },
    [place],
  );

  const commands = useMemo<ExportCommands>(
    () => ({
      diagram: (diagramId) => {
        const state = modelStore.getState();
        const diagram =
          diagramId === undefined
            ? state.present.diagrams.length === 1
              ? state.present.diagrams[0]
              : undefined
            : state.present.diagrams.find(
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
        produce(exportFiles.pdf, (state) => compiled(state, renders));
      },
      png: () => {
        produce(exportFiles.png, (state) => drawn(state, renders));
      },
    }),
    [place, produce, renders],
  );

  const dismissNotice = useCallback((): void => {
    setNotice(undefined);
  }, []);

  useEffect(
    () =>
      onCanvasOrPanelChange(() => {
        setNotice((current) =>
          current?.refusal === true ? current : undefined,
        );
      }),
    [],
  );

  return useMemo(
    () => ({ commands, notice, dismissNotice }),
    [commands, dismissNotice, notice],
  );
}

async function compiled(
  state: State,
  renders: RenderExports,
): Promise<Either.Either<Produced, ExportNotice>> {
  const projection = renderTypst(state.present);
  const assets = await renders.pdfAssets();
  if (Either.isLeft(assets)) {
    return Either.left(assetNotice(assets.left, 'PDF compiler'));
  }
  return Either.mapBoth(await renders.compile(projection.typst, assets.right), {
    onLeft: compileNotice,
    onRight: (pdf) => ({
      content: new Uint8Array(pdf),
      unplaced: projection.unplaced,
    }),
  });
}

async function drawn(
  state: State,
  renders: RenderExports,
): Promise<Either.Either<Produced, ExportNotice> | undefined> {
  const diagram = activeDiagram(state);
  if (diagram === undefined) {
    return undefined;
  }
  const assets = await renders.pngAssets();
  if (Either.isLeft(assets)) {
    return Either.left(assetNotice(assets.left, 'SVG rasterizer'));
  }
  return Either.mapBoth(
    await renders.draw(diagram, state.present, { assets: assets.right }),
    {
      onLeft: rasterNotice,
      onRight: (image: PngImage) => ({
        content: image.png,
        unplaced: image.unplaced,
      }),
    },
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
      refusal: true,
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
    : {
        headline,
        details: details.map((line) => line.trim()),
        refusal: false,
      };
}

function assetNotice(
  failure: RenderAssetFailureType,
  reader: string,
): ExportNotice {
  return RenderAssetFailure.$match(failure, {
    Unavailable: ({ reason }) => ({
      headline: `Saerskriven could not load the ${reader}.`,
      details: [reason],
      refusal: true,
    }),
  });
}

function compileNotice(failure: PdfFailure): ExportNotice {
  return PdfFailure.$match(failure, {
    Refused: ({ sentences }) => ({
      headline: 'Saerskriven could not compile the PDF.',
      details: sentences,
      refusal: true,
    }),
    NoDocument: () => ({
      headline: 'The Typst compiler produced no PDF.',
      details: [],
      refusal: true,
    }),
  });
}

function rasterNotice(failure: ResvgFailure): ExportNotice {
  const said = ResvgFailure.$match(failure, {
    Refused: ({ sentence }) => sentence,
    Unusable: ({ sentence }) => sentence,
  });
  return {
    headline: 'Saerskriven could not draw the PNG.',
    details: [said],
    refusal: true,
  };
}
