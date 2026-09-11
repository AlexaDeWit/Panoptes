import { studioBuildId } from '../version.js';
import { FileLifecycle, initialState } from './state.js';
import { sampleModel } from './store.fixtures.js';
import { channelStoreSync, type SyncedState } from './sync.js';

const synced: SyncedState = {
  ...initialState(sampleModel),
  file: FileLifecycle.Opened({
    name: 'model.yaml',
    source: { format: 'saerskriven-yaml', document: undefined },
  }),
  recoveryCurrent: true,
};

function fakeChannel() {
  const posted: unknown[] = [];
  const target = new EventTarget();
  return {
    posted,
    channel: {
      postMessage: (message: unknown) => {
        posted.push(message);
      },
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
    },
    deliver: (data: unknown) => {
      target.dispatchEvent(new MessageEvent('message', { data }));
    },
  };
}

describe('the tab sync', () => {
  it('publishes the result under this build and follows only the same build back', () => {
    const fake = fakeChannel();
    const sync = channelStoreSync(() => fake.channel);
    const followed: SyncedState[] = [];
    const stop = sync.watch((state) => {
      followed.push(state);
    });

    sync.publish(synced);
    expect(fake.posted).toEqual([
      { version: 1, build: studioBuildId, state: synced },
    ]);

    fake.deliver(fake.posted[0]);
    fake.deliver({ version: 2, build: studioBuildId, state: synced });
    fake.deliver({ version: 1, build: 'another deploy', state: synced });
    fake.deliver('not an envelope');
    stop();
    fake.deliver(fake.posted[0]);

    expect(followed).toEqual([synced]);
  });

  it('does nothing where the platform has no channel', () => {
    const sync = channelStoreSync(() => undefined);

    expect(() => {
      sync.publish(synced);
      sync.watch(() => undefined)();
    }).not.toThrow();
  });
});
