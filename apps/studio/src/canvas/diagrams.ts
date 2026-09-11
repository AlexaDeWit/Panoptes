import type { DiagramId } from '@saerskriven/model';
import { Action } from '../store/actions.js';
import { activeDiagram, activeDiagramId } from '../store/selectors.js';
import { dispatch, modelStore } from '../store/store.js';
import { announce } from './announcements.js';

/**
 * Puts the diagram `diagramId` names on screen and says so, and does nothing
 * where it is on screen already or the model does not hold it.
 */
export function showDiagram(diagramId: DiagramId): boolean {
  const before = activeDiagramId(modelStore.getState());
  dispatch(Action.SelectDiagram({ diagramId }));
  const shown = activeDiagram(modelStore.getState());
  if (shown === undefined || shown.id === before) {
    return false;
  }
  announce(`Showing ${shown.title}.`);
  return true;
}

/**
 * Shows the diagram one place along the model's list from the one on screen,
 * forward or back, wrapping at either end.
 */
export function stepDiagram(direction: 'next' | 'previous'): boolean {
  const state = modelStore.getState();
  const diagrams = state.present.diagrams;
  const current = activeDiagramId(state);
  const at = diagrams.findIndex((diagram) => diagram.id === current);
  if (diagrams.length < 2 || at < 0) {
    return false;
  }
  const step = direction === 'next' ? 1 : diagrams.length - 1;
  const target = diagrams[(at + step) % diagrams.length];
  return target === undefined ? false : showDiagram(target.id);
}
