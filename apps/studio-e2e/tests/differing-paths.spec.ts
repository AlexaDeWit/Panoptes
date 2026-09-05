import { differingPaths, identified } from '../src/differing-paths.js';

const cells = [
  { id: 'a', name: 'Écluse proxy' },
  { id: 'b', name: 'Mirror worker' },
];

describe('differingPaths', () => {
  it('lists no path where both sides hold the same value', () => {
    expect(
      differingPaths({ cells }, { cells: structuredClone(cells) }),
    ).toStrictEqual([]);
  });

  it('names a changed leaf by the path that reaches it', () => {
    expect(
      differingPaths(
        { detail: { threatTop: 28 } },
        { detail: { threatTop: 103 } },
      ),
    ).toStrictEqual(['detail.threatTop']);
  });

  it('names a key one side holds and the other does not, either way round', () => {
    expect(differingPaths({ owner: 'Alexandra' }, {})).toStrictEqual(['owner']);
    expect(differingPaths({}, { reviewer: '' })).toStrictEqual(['reviewer']);
  });

  it('reports an added record at its own path rather than walking its fields', () => {
    expect(
      differingPaths(
        { cells },
        { cells: [...cells, { id: 'c', name: 'New store' }] },
      ),
    ).toStrictEqual(['cells[2]']);
  });

  it('reads array order as a difference at every position that moved', () => {
    expect(
      differingPaths({ cells }, { cells: [cells[1], cells[0]] }),
    ).toStrictEqual([
      'cells[0].id',
      'cells[0].name',
      'cells[1].id',
      'cells[1].name',
    ]);
  });

  it('compares by key name, so a reordered key is no difference at all', () => {
    expect(
      differingPaths(
        JSON.parse('{"a": 1, "b": 2}'),
        JSON.parse('{"b": 2, "a": 1}'),
      ),
    ).toStrictEqual([]);
  });
});

describe('identified', () => {
  it('keys every record by its own id', () => {
    expect(identified(cells)).toStrictEqual({ a: cells[0], b: cells[1] });
  });

  it('follows identity rather than position, so a reordered list is no difference', () => {
    expect(
      differingPaths(identified(cells), identified([cells[1], cells[0]])),
    ).toStrictEqual([]);
  });

  it('keeps one entry for a duplicated id, the last of them, so the record before it is never compared', () => {
    const twice = [
      { id: 'a', name: 'Écluse proxy' },
      { id: 'a', name: 'Mirror worker' },
    ];
    expect(identified(twice)).toStrictEqual({ a: twice[1] });
    expect(
      differingPaths(identified(twice), identified([twice[0]])),
    ).toStrictEqual(['a.name']);
  });
});
