import { layoutDiagram, type CanvasLayout } from '@panoptes/canvas';
import type { DiagramId, ElementId, Model } from '@panoptes/model';
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

/**
 * The diagram on screen laid out, which is the first the model holds until
 * the studio shows more than one, and nothing at all while the model holds
 * none.
 *
 * The answer is kept against the model it was laid out from, in a `WeakMap`
 * so that keeping it holds no model alive, and handed back while the model
 * and the diagram are the same objects. Saving the work is the smaller half
 * of why: zustand reads a store through `useSyncExternalStore`, which
 * refuses a snapshot that is a new object on every call, so a selector
 * laying the diagram out afresh each time takes the canvas down rather than
 * merely slowing it. Every model operation returns a new model, so an edit
 * lays the diagram out once, a dispatch that moves something else does not
 * lay it out at all, and an undo, which restores an earlier model, finds
 * that model's own layout still here.
 */
export function currentLayout(state: State): CanvasLayout {
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

/** The element the studio has selected, or nothing while none is. */
export function selectedElement(state: State): ElementId | undefined {
  return state.selection;
}
