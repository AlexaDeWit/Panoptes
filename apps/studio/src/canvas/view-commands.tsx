import type { Model } from '@saerskriven/model';
import { useReactFlow, useStore } from '@xyflow/react';
import { useEffect, useMemo, useRef } from 'react';
import type { ViewCommands } from '../commands/registry.js';
import { modelAsOpened } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import { currentLayout } from './layout.js';
import { fitViewport } from './viewport.js';

/**
 * The viewport half of the command surface ([the
 * commands](../commands/README.md)). Zooming is React Flow's own, and fitting
 * is this directory's calculation over the laid-out diagram's ink, so the fit
 * a person asks for and the fit an open performs are one answer.
 */
export function useViewCommands(): ViewCommands {
  const flow = useReactFlow();
  const fit = useCanvasFit();

  return useMemo(
    () => ({
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
    [fit, flow],
  );
}

/**
 * Fits the viewport to a model as it arrives, so opening a file draws the
 * diagram it carries rather than leaving it wherever the model before it put
 * the view. It draws nothing and belongs inside React Flow, which is what
 * holds the canvas's own extent.
 *
 * The model is read by identity ([the store's
 * selectors](../store/selectors.ts)): a second open is a second model object
 * and fits again, an edit is not a model as it arrived and does not, and the
 * one already fitted is not fitted twice as the canvas is resized.
 */
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

function useCanvasFit(): (() => void) | undefined {
  const flow = useReactFlow();
  const bounds = useModelStore((state) => currentLayout(state).bounds);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);

  return useMemo(() => {
    const viewport = fitViewport(bounds, { width, height });
    return viewport === undefined
      ? undefined
      : () => {
          void flow.setViewport(viewport);
        };
  }, [bounds, flow, height, width]);
}
