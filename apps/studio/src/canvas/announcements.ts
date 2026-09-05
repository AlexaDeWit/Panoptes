import { useSyncExternalStore } from 'react';

/**
 * What the canvas last said about an edit, and how many have been said. The
 * count is what lets the same words be announced twice: a live region speaks
 * when its content changes, so two adds of the same kind would otherwise be
 * announced once.
 */
export type Announcement = {
  readonly message: string;
  readonly sequence: number;
};

const nothingSaid: Announcement = { message: '', sequence: 0 };

let current = nothingSaid;

const listeners = new Set<() => void>();

/**
 * Says `message` in the canvas's live region. It is a channel of its own
 * rather than a field of the model store: an announcement is not the model,
 * it must not ride the undo stacks, and the palette and the canvas are
 * siblings that both speak into one region. It reaches the region the way
 * `dispatch` reaches the store, so an edit command has one way to say what
 * it did wherever it was invoked from.
 */
export function announce(message: string): void {
  current = { message, sequence: current.sequence + 1 };
  for (const listener of listeners) {
    listener();
  }
}

/** Forgets what was said, which is how a spec starts from silence. */
export function resetAnnouncements(): void {
  current = nothingSaid;
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
