import { layoutDiagram, type CanvasLayout } from '@saerskriven/canvas';
import type { DiagramId, Model } from '@saerskriven/model';
import type { State } from '../store/state.js';

type LaidOut = {
  readonly diagram: DiagramId;
  readonly layout: CanvasLayout;
};

const laidOut = new WeakMap<Model, LaidOut>();

/** The layout of a model that holds no diagram to draw. */
export const emptyLayout: CanvasLayout = {
  nodes: [],
  edges: [],
  unplaced: [],
  bounds: { x: 0, y: 0, width: 0, height: 0 },
};

/** Lays out the first diagram and caches by model identity. Stable snapshots are required by useSyncExternalStore, including after undo. */
export function currentLayout(state: Pick<State, 'present'>): CanvasLayout {
  const diagram = state.present.diagrams.at(0);
  if (diagram === undefined) {
    return emptyLayout;
  }
  const last = laidOut.get(state.present);
  if (last?.diagram === diagram.id) {
    return last.layout;
  }
  const layout = layoutDiagram(diagram, state.present);
  laidOut.set(state.present, { diagram: diagram.id, layout });
  return layout;
}
