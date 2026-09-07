import { useSyncExternalStore } from 'react';
import { modelStore } from '../store/store.js';

export type Announcement = {
  readonly message: string;
  readonly sequence: number;
};

const nothingSaid: Announcement = { message: '', sequence: 0 };

let current = nothingSaid;

const listeners = new Set<() => void>();

modelStore.subscribe((state, previous) => {
  if (
    state.present !== previous.present ||
    state.selection !== previous.selection ||
    state.renaming !== previous.renaming
  ) {
    clear();
  }
});

export function announce(message: string): void {
  current = { message, sequence: current.sequence + 1 };
  notify();
}

export function resetAnnouncements(): void {
  current = nothingSaid;
  notify();
}

function clear(): void {
  if (current.message === '') {
    return;
  }
  current = { ...current, message: '' };
  notify();
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** What was last said, for a spec and for {@link useAnnouncement} alike. */
export function currentAnnouncement(): Announcement {
  return current;
}

/** Subscribes a component to {@link announce}. */
export function useAnnouncement(): Announcement {
  return useSyncExternalStore(
    subscribe,
    currentAnnouncement,
    currentAnnouncement,
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
