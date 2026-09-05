import { layoutDiagram, type CanvasLayout } from '@panoptes/canvas';
import type { DiagramId, ElementId, Model } from '@panoptes/model';
import type { State } from '../store/state.js';

type LastLayout = {
  readonly model: Model;
  readonly diagram: DiagramId;
  readonly layout: CanvasLayout;
};

let last: LastLayout | undefined;

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
 * A selector runs on every dispatch and zustand compares what it returns by
 * identity, so this keeps the last answer and hands it back while the model
 * and the diagram are the same objects. Every model operation returns a new
 * model, so an edit lays the diagram out exactly once and a dispatch that
 * moves something else, a selection say, lays it out not at all. One entry
 * is enough for one canvas; an undo, which restores an earlier model, lays
 * that model out again.
 */
export function currentLayout(state: State): CanvasLayout {
  const diagram = state.present.diagrams.at(0);
  if (diagram === undefined) {
    return emptyLayout;
  }
  if (last?.model === state.present && last.diagram === diagram.id) {
    return last.layout;
  }
  const layout = layoutDiagram(diagram, state.present);
  last = { model: state.present, diagram: diagram.id, layout };
  return layout;
}

/** The element the studio has selected, or nothing while none is. */
export function selectedElement(state: State): ElementId | undefined {
  return state.selection;
}
