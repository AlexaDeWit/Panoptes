import { useSyncExternalStore } from 'react';
import { announce } from './announcements.js';

let enabled = false;
const listeners = new Set<() => void>();

/** Whether pointer movement snaps nodes to the visible grid. */
export function currentSnap(): boolean {
  return enabled;
}

/** Toggles snapping without changing the document or history. */
export function toggleSnap(): void {
  enabled = !enabled;
  for (const listener of listeners) {
    listener();
  }
  announce(enabled ? 'Snap to grid on.' : 'Snap to grid off.');
}

/** Subscribes a control to the snap setting. */
export function useSnap(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    currentSnap,
    currentSnap,
  );
}
