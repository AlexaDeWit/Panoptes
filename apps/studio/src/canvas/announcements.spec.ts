import { act, renderHook } from '@testing-library/react';
import {
  announce,
  currentAnnouncement,
  resetAnnouncements,
  useAnnouncement,
} from './announcements.js';

describe('announce', () => {
  beforeEach(() => {
    resetAnnouncements();
  });

  it('holds what was last said', () => {
    announce('Added New actor, actor.');

    expect(currentAnnouncement().message).toBe('Added New actor, actor.');
  });

  it('counts every announcement, so the same words twice over are two of them', () => {
    announce('Added New actor, actor.');
    const first = currentAnnouncement();
    announce('Added New actor, actor.');

    expect(currentAnnouncement().sequence).toBe(first.sequence + 1);
  });

  it('hands back the same value while nothing is said, as a subscription needs', () => {
    expect(currentAnnouncement()).toBe(currentAnnouncement());
  });

  it('starts again from silence when reset', () => {
    announce('Added New actor, actor.');
    resetAnnouncements();

    expect(currentAnnouncement().message).toBe('');
  });
});

describe('useAnnouncement', () => {
  beforeEach(() => {
    resetAnnouncements();
  });

  it('tells a subscribed component what was said, and that it was unsaid', () => {
    const { result } = renderHook(() => useAnnouncement());

    act(() => {
      announce(
        'Removed Reader, actor. no flows detached, no threat links dropped.',
      );
    });
    expect(result.current.message).toBe(
      'Removed Reader, actor. no flows detached, no threat links dropped.',
    );

    act(() => {
      resetAnnouncements();
    });
    expect(result.current.message).toBe('');
  });
});
