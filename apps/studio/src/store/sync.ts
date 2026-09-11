import { z } from 'zod';
import { studioBuildId } from '../version.js';
import type { State } from './state.js';

const syncVersion = 1;

/** The channel every studio tab of one origin shares. */
export const syncChannelName = 'saerskriven:studio:sync';

/**
 * The result of a change, which is what one tab shows the others: the model,
 * both stacks, the saved point, the file, and whether the recovery storage
 * holds it. Selection and an open field stay with the tab that made them.
 */
export type SyncedState = Pick<
  State,
  'present' | 'past' | 'future' | 'saved' | 'file' | 'recoveryCurrent'
>;

/**
 * Carries synced state between the tabs of one origin. `publish` sends this
 * tab's result to every other tab and `watch` receives theirs, never this
 * tab's own, and returns the function that stops watching.
 */
export type StoreSync = {
  readonly publish: (state: SyncedState) => void;
  readonly watch: (follow: (state: SyncedState) => void) => () => void;
};

type Channel = Pick<
  BroadcastChannel,
  'postMessage' | 'addEventListener' | 'removeEventListener'
>;

/**
 * A message is trusted on its build alone: it comes from this origin's own
 * code by structured clone, which keeps the references the stacks and the
 * saved point share, and a tab left open across a deploy is the one case
 * the build guards, since two tabs share a build exactly when they run the
 * same code.
 */
const envelopeSchema = z.object({
  version: z.literal(syncVersion),
  build: z.literal(studioBuildId),
  state: z.custom<SyncedState>(() => true),
});

/** Syncs through one channel the tab opens on first use. */
export function channelStoreSync(open: () => Channel | undefined): StoreSync {
  let channel: Channel | undefined;
  const opened = (): Channel | undefined => (channel ??= open());
  return {
    publish: (state) => {
      opened()?.postMessage({
        version: syncVersion,
        build: studioBuildId,
        state,
      });
    },
    watch: (follow) => {
      const received = (event: MessageEvent): void => {
        const envelope = envelopeSchema.safeParse(event.data);
        if (envelope.success) {
          follow(envelope.data.state);
        }
      };
      const target = opened();
      target?.addEventListener('message', received);
      return () => {
        target?.removeEventListener('message', received);
      };
    },
  };
}

/** The sync between this browser's studio tabs. */
export const browserStoreSync = channelStoreSync(() =>
  typeof BroadcastChannel === 'undefined'
    ? undefined
    : new BroadcastChannel(syncChannelName),
);
