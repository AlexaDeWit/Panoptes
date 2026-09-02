import { equivalent } from './equivalence.js';

describe('equivalent', () => {
  it('holds two documents saying the same thing to be the same', () => {
    expect(
      equivalent(
        { cells: [{ id: 'a', at: { x: 1, y: 2 } }], tags: [] },
        { cells: [{ id: 'a', at: { x: 1, y: 2 } }], tags: [] },
      ),
    ).toBe(true);
  });

  it('parts them on a value, a key, an order, or a length', () => {
    expect(equivalent({ x: 1 }, { x: 2 })).toBe(false);
    expect(equivalent({ x: 1 }, { x: 1, y: 1 })).toBe(false);
    expect(equivalent({ x: 1, y: 1 }, { x: 1 })).toBe(false);
    expect(equivalent([1, 2], [2, 1])).toBe(false);
    expect(equivalent([1], [1, 2])).toBe(false);
  });

  it('parts a list from a record and a record from a bare value', () => {
    expect(equivalent([], {})).toBe(false);
    expect(equivalent({}, 'nothing')).toBe(false);
    expect(equivalent(null, {})).toBe(false);
    expect(equivalent(null, null)).toBe(true);
  });

  it('compares a key named after a prototype member like any other', () => {
    const inherited = Object.fromEntries<unknown>([['toString', 'no']]);
    expect(equivalent(inherited, {})).toBe(false);
    expect(equivalent({}, inherited)).toBe(false);
    expect(equivalent(inherited, { toString: 'no' })).toBe(true);
  });
});
