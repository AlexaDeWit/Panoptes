import { layoutDiagram, type CanvasLayout } from '@saerskriven/canvas';
import type { DiagramId, Model } from '@saerskriven/model';
import { activeDiagram } from '../store/selectors.js';
import type { State } from '../store/state.js';

const laidOut = new WeakMap<Model, Map<DiagramId, CanvasLayout>>();

/** The layout of a model that holds no diagram to draw. */
export const emptyLayout: CanvasLayout = {
  nodes: [],
  edges: [],
  unplaced: [],
  bounds: { x: 0, y: 0, width: 0, height: 0 },
};

/**
 * Lays out the diagram on screen and caches by model identity and diagram
 * id, so a switch back to a diagram already laid out hands back the same
 * object. Stable snapshots are required by useSyncExternalStore, including
 * after undo.
 */
export function currentLayout(
  state: Pick<State, 'present' | 'activeDiagram'>,
): CanvasLayout {
  const diagram = activeDiagram(state);
  if (diagram === undefined) {
    return emptyLayout;
  }
  const layouts =
    laidOut.get(state.present) ?? new Map<DiagramId, CanvasLayout>();
  const cached = layouts.get(diagram.id);
  if (cached !== undefined) {
    return cached;
  }
  const layout = layoutDiagram(diagram, state.present);
  layouts.set(diagram.id, layout);
  laidOut.set(state.present, layouts);
  return layout;
}
