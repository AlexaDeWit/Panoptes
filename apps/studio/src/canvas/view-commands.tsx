import { drawnBounds } from '@saerskriven/canvas';
import type { Model } from '@saerskriven/model';
import { useReactFlow, useStore } from '@xyflow/react';
import { useEffect, useMemo, useRef } from 'react';
import type { ViewCommands } from '../commands/registry.js';
import { modelAsOpened } from '../store/selectors.js';
import { modelStore, useModelStore } from '../store/store.js';
import { currentLayout } from './layout.js';
import { clearOfPanel, fitViewport } from './viewport.js';

/** View commands share the measured pane coverage with automatic selection reveal. */
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

/** Fits each newly opened model once. */
export function FitOnOpen() {
  const fit = useCanvasFit();
  const opened = useModelStore(modelAsOpened);
  const fitted = useRef<Model | undefined>(undefined);

  useEffect(() => {
    if (
      fit === undefined ||
      opened === undefined ||
      opened === fitted.current
    ) {
      return;
    }
    fitted.current = opened;
    fit();
  }, [fit, opened]);

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
