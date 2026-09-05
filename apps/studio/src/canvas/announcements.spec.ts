import {
  announce,
  currentAnnouncement,
  resetAnnouncements,
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
