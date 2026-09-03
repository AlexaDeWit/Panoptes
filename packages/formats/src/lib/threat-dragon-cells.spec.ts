import { elementSchema, type Element } from '@panoptes/model';
import type { ThreatDragonCell } from '@panoptes/wire-threat-dragon';
import { renderDivergences } from './divergence.js';
import { mergeCell } from './threat-dragon-cells.js';

const elementOf = (input: unknown): Element => elementSchema.parse(input);

const box = { position: { x: 10, y: 20 }, size: { width: 100, height: 60 } };

const named = {
  name: 'Ledger',
  description: 'Keeps the entries.',
  outOfScope: false,
  reasonOutOfScope: '',
};

const store = elementOf({ kind: 'store', id: 'cell-1', ...named, ...box });

const cellOf = (element: Element, held?: ThreatDragonCell): ThreatDragonCell =>
  mergeCell(element, held, [], 0).cell;

describe('drawing an element the source document holds no cell for', () => {
  it.each([
    ['actor', 'actor', 'tm.Actor'],
    ['process', 'process', 'tm.Process'],
    ['store', 'store', 'tm.Store'],
  ])('draws a %s as its own shape and type', (kind, shape, type) => {
    const cell = cellOf(elementOf({ kind, id: 'cell-1', ...named, ...box }));
    expect(cell).toEqual({
      id: 'cell-1',
      zIndex: 1,
      shape,
      position: box.position,
      size: box.size,
      data: {
        type,
        name: 'Ledger',
        description: 'Keeps the entries.',
        hasOpenThreats: false,
      },
    });
  });

  it('draws a flow from its endpoints and the points it passes through', () => {
    expect(
      cellOf(
        elementOf({
          kind: 'flow',
          id: 'cell-1',
          ...named,
          source: { kind: 'attached', element: 'cell-2' },
          target: { kind: 'free', position: { x: 5, y: 6 } },
          waypoints: [{ x: 1, y: 2 }],
        }),
      ),
    ).toMatchObject({
      shape: 'flow',
      source: { cell: 'cell-2' },
      target: { x: 5, y: 6 },
      vertices: [{ x: 1, y: 2 }],
    });
  });

  it('draws a boundary curve through its ends and its middle', () => {
    expect(
      cellOf(
        elementOf({
          kind: 'trust-boundary',
          id: 'cell-1',
          ...named,
          shape: {
            kind: 'curve',
            waypoints: [
              { x: 0, y: 0 },
              { x: 5, y: 5 },
              { x: 9, y: 0 },
            ],
          },
        }),
      ),
    ).toMatchObject({
      shape: 'trust-boundary-curve',
      source: { x: 0, y: 0 },
      vertices: [{ x: 5, y: 5 }],
      target: { x: 9, y: 0 },
      data: { type: 'tm.Boundary', isTrustBoundary: true },
    });
  });

  it('writes a note text where Threat Dragon reads one', () => {
    expect(
      cellOf(
        elementOf({
          kind: 'text',
          id: 'cell-1',
          ...named,
          name: '',
          ...box,
          text: 'Reviewed in August.',
        }),
      ),
    ).toMatchObject({
      shape: 'td-text-block',
      data: { type: 'tm.Text', name: 'Reviewed in August.' },
    });
  });
});

describe('drawing an element over the cell the source document holds', () => {
  const held: ThreatDragonCell = {
    id: 'cell-1',
    shape: 'store',
    zIndex: 7,
    position: { x: 10, y: 20 },
    size: { width: 100, height: 60 },
    tools: { name: 'button-remove' },
    ports: { items: [{ group: 'left', id: 'port-1' }] },
    data: {
      type: 'tm.Store',
      name: 'Ledger',
      description: 'Keeps the entries.',
      isEncrypted: true,
      hasOpenThreats: true,
    },
  };

  it('leaves the plane, the tools, the ports and the flags it never held', () => {
    expect(cellOf(store, held)).toEqual(held);
  });

  it('draws the cell again where the element is no longer that shape', () => {
    const merged = mergeCell(
      elementOf({ kind: 'actor', id: 'cell-1', ...named, ...box }),
      held,
      [],
      0,
    );
    expect(merged.cell).toEqual({
      id: 'cell-1',
      zIndex: 1,
      shape: 'actor',
      position: box.position,
      size: box.size,
      data: {
        type: 'tm.Actor',
        name: 'Ledger',
        description: 'Keeps the entries.',
        hasOpenThreats: false,
      },
    });
    expect(renderDivergences(merged.divergences)).toBe(
      'element "cell-1": what the source held on the store cell of this id, which now draws a actor (removed by an edit)',
    );
  });
});

describe('an element carrying what the format has no place for', () => {
  it('reports a note named beside its text', () => {
    const merged = mergeCell(
      elementOf({
        kind: 'text',
        id: 'cell-1',
        ...named,
        ...box,
        text: 'Reviewed in August.',
      }),
      undefined,
      [],
      0,
    );
    expect(renderDivergences(merged.divergences)).toBe(
      'element "cell-1": the name "Ledger", which the format has one text for a note and no name beside it (no place in the format)',
    );
  });

  it('reports a boundary put out of scope', () => {
    const merged = mergeCell(
      elementOf({
        kind: 'trust-boundary',
        id: 'cell-1',
        ...named,
        outOfScope: true,
        reasonOutOfScope: 'Drawn for context alone.',
        shape: { kind: 'box', ...box },
      }),
      undefined,
      [],
      0,
    );
    expect(renderDivergences(merged.divergences)).toBe(
      'element "cell-1": the out-of-scope marking, which the format records on the elements a threat attaches to alone (no place in the format)',
    );
  });
});
