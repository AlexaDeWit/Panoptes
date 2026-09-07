import type { ElementId } from '@saerskriven/model';
import { useSyncExternalStore } from 'react';
import { selectedElement } from '../store/selectors.js';
import { modelStore } from '../store/store.js';
import { resetAnnouncements } from './announcements.js';
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
  if (next.open === current.open && next.from === current.from) {
    return;
  }
  current = next;
  resetAnnouncements();
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
