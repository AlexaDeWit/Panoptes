import type { CommandSurface } from './registry.js';

/** A surface that records what a command asked of it, in the order asked. */
export type RecordingSurface = {
  readonly surface: CommandSurface;
  readonly asked: string[];
};

/** A {@link CommandSurface} that answers nothing and remembers everything. */
export function recordingSurface(): RecordingSurface {
  const asked: string[] = [];
  const note = (what: string) => (): void => {
    asked.push(what);
  };
  return {
    asked,
    surface: {
      files: {
        open: note('open'),
        import: note('import'),
        save: note('save'),
        saveAs: note('saveAs'),
        exportDiagram: note('exportDiagram'),
        exportRegister: note('exportRegister'),
        exportTypst: note('exportTypst'),
        exportPdf: note('exportPdf'),
        close: note('close'),
      },
      reference: { toggle: note('toggleReference') },
      view: {
        zoomIn: note('zoomIn'),
        zoomOut: note('zoomOut'),
        fitToView: note('fitToView'),
        fitSelection: note('fitSelection'),
        resetZoom: note('resetZoom'),
      },
    },
  };
}
