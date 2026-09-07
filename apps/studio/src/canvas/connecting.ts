import type { ElementId } from '@saerskriven/model';
import { useSyncExternalStore } from 'react';
import { selectedElement } from '../store/selectors.js';
import { modelStore } from '../store/store.js';
import { connectElements } from './edits.js';
import { flowEnds } from './elements.js';
import { currentLayout } from './layout.js';

/**
 * Whether the target chooser is open, and the element a flow already started
 * runs from.
 */
export type Connecting = {
  readonly open: boolean;
  readonly from: ElementId | undefined;
};

const atRest: Connecting = { open: false, from: undefined };

let current = atRest;

const listeners = new Set<() => void>();

/**
 * Starts a flow from the selected element by opening the target chooser on
 * it, which is what the start-flow command runs. It is a channel of its own
 * rather than a field of the model store, on the same terms as the canvas's
 * announcements: a gesture in progress is not the model and must not ride
 * the undo stacks, and a command reaches it from wherever it was pressed.
 *
 * A selection that is no end of a flow starts nothing. The chooser is
 * disabled there and {@link connectElements} would refuse the flow anyway,
 * so the key press is claimed from the browser and does nothing else.
 */
export function startFlow(): void {
  const state = modelStore.getState();
  const selection = selectedElement(state);
  const ends = flowEnds(currentLayout(state));
  if (selection === undefined || !ends.some((node) => node.id === selection)) {
    return;
  }
  moveTo({ open: true, from: selection });
}

/**
 * Opens or closes the chooser at the control's own asking. Closing ends the
 * flow the command started, which is what Escape and a click outside the
 * chooser both come to.
 */
export function chooserOpened(open: boolean): void {
  moveTo(open ? { open: true, from: current.from } : atRest);
}

/**
 * Draws the flow a chosen target commits, and answers whether it drew one.
 */
export function commitFlowTarget(
  target: ElementId,
  from: ElementId | undefined = current.from,
): boolean {
  if (from === undefined) {
    return false;
  }
  moveTo(atRest);
  connectElements(from, target);
  return true;
}

/** Forgets a flow in progress, which is how a spec starts from rest. */
export function resetConnecting(): void {
  moveTo(atRest);
}

/** What the chooser is showing, for a spec and for {@link useConnecting}. */
export function currentConnecting(): Connecting {
  return current;
}

/** Subscribes a component to {@link startFlow} and its two endings. */
export function useConnecting(): Connecting {
  return useSyncExternalStore(subscribe, currentConnecting, currentConnecting);
}

function moveTo(next: Connecting): void {
  current = next;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
