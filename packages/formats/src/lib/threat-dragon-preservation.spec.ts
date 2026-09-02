import {
  preservedFlag,
  preservedList,
  preservedText,
} from './threat-dragon-preservation.js';

describe('a value the source document already holds', () => {
  it('stays as the file spelled it where the model agrees', () => {
    expect(preservedText('Tampering', 'Tampering')).toBe('Tampering');
    expect(preservedFlag(true, true)).toBe(true);
    expect(preservedList([{ x: 1 }], [{ x: 1 }])).toEqual([{ x: 1 }]);
  });

  it('is rewritten where an edit moved it', () => {
    expect(preservedText('Tampering', 'Spoofing')).toBe('Spoofing');
    expect(preservedFlag(false, true)).toBe(true);
    expect(preservedList([{ x: 1 }], [{ x: 2 }])).toEqual([{ x: 2 }]);
  });
});

describe('a key the source document never carried', () => {
  it('stays absent where the model holds what its absence reads as', () => {
    expect(preservedText(undefined, '')).toBeUndefined();
    expect(preservedFlag(undefined, false)).toBeUndefined();
    expect(preservedList(undefined, [])).toBeUndefined();
  });

  it('is written where the model holds anything else', () => {
    expect(preservedText(undefined, 'Named at last')).toBe('Named at last');
    expect(preservedFlag(undefined, true)).toBe(true);
    expect(preservedList(undefined, [{ x: 1 }])).toEqual([{ x: 1 }]);
  });
});
