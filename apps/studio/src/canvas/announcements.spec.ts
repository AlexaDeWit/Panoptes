import { act, renderHook } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { actorElement, sampleModel } from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  announce,
  currentAnnouncement,
  resetAnnouncements,
  useAnnouncement,
} from './announcements.js';

describe('announce', () => {
  const message = 'message';

  beforeEach(() => {
    modelStore.setState(initialState(sampleModel), true);
    resetAnnouncements();
  });

  it('holds what was last said', () => {
    announce(message);

    expect(currentAnnouncement().message).toBe(message);
  });

  it('counts every announcement, so the same words twice over are two of them', () => {
    announce(message);
    const first = currentAnnouncement();
    announce(message);

    expect(currentAnnouncement().sequence).toBe(first.sequence + 1);
  });

  it('hands back the same value while nothing is said, as a subscription needs', () => {
    expect(currentAnnouncement()).toBe(currentAnnouncement());
  });

  it('starts again from silence when reset', () => {
    announce(message);
    resetAnnouncements();

    expect(currentAnnouncement().message).toBe('');
  });

  it('clears when the next action changes canvas state', () => {
    announce(message);

    dispatch(Action.Select({ elementIds: [actorElement] }));

    expect(currentAnnouncement().message).toBe('');
  });

  it('stays when an action changes nothing', () => {
    announce(message);

    dispatch(Action.Undo());

    expect(currentAnnouncement().message).toBe(message);
  });
});

describe('useAnnouncement', () => {
  beforeEach(() => {
    modelStore.setState(initialState(sampleModel), true);
    resetAnnouncements();
  });

  it('tells a subscribed component what was said, and that it was unsaid', () => {
    const { result } = renderHook(() => useAnnouncement());
    const message = 'message';

    act(() => {
      announce(message);
    });
    expect(result.current.message).toBe(message);

    act(() => {
      resetAnnouncements();
    });
    expect(result.current.message).toBe('');
  });
});
