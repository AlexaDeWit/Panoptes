import { drawnBounds } from '@saerskriven/canvas';
import type { DiagramId, Model } from '@saerskriven/model';
import { useReactFlow, useStore } from '@xyflow/react';
import { useEffect, useMemo, useRef } from 'react';
import type { ViewCommands } from '../commands/registry.js';
import { activeDiagramId, modelAsOpened } from '../store/selectors.js';
import { modelStore, useModelStore } from '../store/store.js';
import { currentLayout } from './layout.js';
import { clearOfPanel, fitViewport } from './viewport.js';

/** View commands use the measured pane coverage for explicit fitting. */
export function useViewCommands(panelCover = 0): ViewCommands {
  const flow = useReactFlow();
  const fit = useCanvasFit(panelCover);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);

  return useMemo(
    () => ({
      resetZoom: () => {
        void flow.zoomTo(1);
      },
      fitSelection: () => {
        const state = modelStore.getState();
        const layout = currentLayout(state);
        const selected = new Set(state.selection);
        const bounds = drawnBounds(
          layout.nodes.filter((node) => selected.has(node.id)),
          layout.edges.filter((edge) => selected.has(edge.id)),
        );
        const viewport = fitViewport(
          bounds,
          clearOfPanel({ width, height }, panelCover),
        );
        if (viewport !== undefined) {
          void flow.setViewport(viewport);
        }
      },
      zoomIn: () => {
        void flow.zoomIn();
      },
      zoomOut: () => {
        void flow.zoomOut();
      },
      fitToView: () => {
        fit?.();
      },
    }),
    [fit, flow, width, height, panelCover],
  );
}

/** Fits each newly opened model once, and each diagram switched to. */
export function FitOnOpen() {
  const fit = useCanvasFit();
  const opened = useModelStore(modelAsOpened);
  const diagram = useModelStore(activeDiagramId);
  const fitted = useRef<{
    readonly model: Model | undefined;
    readonly diagram: DiagramId | undefined;
  }>({ model: undefined, diagram: undefined });

  useEffect(() => {
    const newlyOpened = opened !== undefined && opened !== fitted.current.model;
    const switched = diagram !== fitted.current.diagram;
    if (fit === undefined || (!newlyOpened && !switched)) {
      return;
    }
    fitted.current = { model: opened ?? fitted.current.model, diagram };
    fit();
  }, [fit, opened, diagram]);

  return null;
}

function useCanvasFit(panelCover = 0): (() => void) | undefined {
  const flow = useReactFlow();
  const bounds = useModelStore((state) => currentLayout(state).bounds);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);

  return useMemo(() => {
    const viewport = fitViewport(
      bounds,
      clearOfPanel({ width, height }, panelCover),
    );
    return viewport === undefined
      ? undefined
      : () => {
          void flow.setViewport(viewport);
        };
  }, [bounds, flow, height, width, panelCover]);
}
