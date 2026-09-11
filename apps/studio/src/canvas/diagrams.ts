import { generateDiagramId, type DiagramId } from '@saerskriven/model';
import { useSyncExternalStore } from 'react';
import { Action } from '../store/actions.js';
import { activeDiagram, activeDiagramId } from '../store/selectors.js';
import { untitledDiagram } from '../store/state.js';
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

/**
 * Adds an empty diagram after the model's others, shows it, and opens its
 * title for editing, so the diagram is named as it is made.
 */
export function createDiagram(): boolean {
  const diagram = {
    id: generateDiagramId(),
    title: untitledDiagram,
    elements: [],
  };
  const before = modelStore.getState().present;
  dispatch(Action.AddDiagram({ diagram }));
  if (modelStore.getState().present === before) {
    return false;
  }
  announce(`Added ${diagram.title}.`);
  beginRenamingDiagram();
  return true;
}

/** Retitles the diagram on screen as one undo step, skipping an unchanged title. */
export function renameActiveDiagram(title: string): boolean {
  const state = modelStore.getState();
  const diagram = activeDiagram(state);
  if (diagram === undefined || diagram.title === title) {
    return false;
  }
  dispatch(Action.RenameDiagram({ diagramId: diagram.id, title }));
  const renamed = activeDiagram(modelStore.getState());
  if (renamed === undefined || renamed.title !== title) {
    return false;
  }
  announce(`Renamed the diagram to ${title}.`);
  return true;
}

let renaming: DiagramId | undefined;

const listeners = new Set<() => void>();

function setRenaming(next: DiagramId | undefined): void {
  if (renaming === next) {
    return;
  }
  renaming = next;
  for (const listener of listeners) {
    listener();
  }
}

/** Opens the title of the diagram on screen in the switcher's field. */
export function beginRenamingDiagram(): void {
  setRenaming(activeDiagramId(modelStore.getState()));
}

/** Closes the switcher's title field, committed or not. */
export function endRenamingDiagram(): void {
  setRenaming(undefined);
}

/**
 * The diagram whose title the switcher's field is open on, and nothing while
 * the switcher is its button. It names the diagram rather than answering
 * yes or no, so an undo, an open or a close that puts another diagram on
 * screen leaves no field open over it.
 */
export function useDiagramRenaming(): DiagramId | undefined {
  return useSyncExternalStore(subscribe, () => renaming);
}

/** Puts the switcher back to its button, for specs. */
export function resetDiagramRenaming(): void {
  setRenaming(undefined);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
