import { elementSchema, type Element } from '@saerskriven/model';
import type { ThreatDragonCell } from '@saerskriven/wire-threat-dragon';
import { renderDivergences } from './divergence.js';
import { mergeCell, withNeededPorts } from './threat-dragon-cells.js';
import { portSides } from './threat-dragon-document.js';

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
  mergeCell(element, held, [], 0, new Map()).cell;

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
          bidirectional: false,
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
      new Map(),
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
      new Map(),
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
      new Map(),
    );
    expect(renderDivergences(merged.divergences)).toBe(
      'element "cell-1": the out-of-scope marking, which the format records on the elements a threat attaches to alone (no place in the format)',
    );
  });
});

const heldFlow = (port?: string): ThreatDragonCell => ({
  id: 'flow-1',
  shape: 'flow',
  source: { x: 0, y: 0 },
  target: port === undefined ? { cell: 'cell-1' } : { cell: 'cell-1', port },
  data: { type: 'tm.Flow', name: 'Ledger', isBidirectional: false },
});

describe('a flow end and the port Threat Dragon fastens it to', () => {
  const ledger: ThreatDragonCell = {
    id: 'cell-1',
    shape: 'store',
    position: box.position,
    size: box.size,
    ports: {
      items: [
        { group: 'top', id: 'port-top' },
        { group: 'right', id: 'port-right' },
      ],
    },
    data: { type: 'tm.Store' },
  };
  const ports = portSides([ledger]);
  const flowTo = (side?: string, bidirectional = false): Element =>
    elementOf({
      kind: 'flow',
      id: 'flow-1',
      ...named,
      source: { kind: 'free', position: { x: 0, y: 0 } },
      target:
        side === undefined
          ? { kind: 'attached', element: 'cell-1' }
          : { kind: 'attached', element: 'cell-1', side },
      waypoints: [],
      bidirectional,
    });
  it('keeps the source anchor where its port sits on the pinned side', () => {
    const merged = mergeCell(flowTo('top'), heldFlow('port-top'), [], 0, ports);
    expect(merged.cell).toMatchObject({
      target: { cell: 'cell-1', port: 'port-top' },
    });
    expect(merged.ports).toEqual([]);
  });

  it('fastens a pinned end to the port the cell declares on that side', () => {
    const merged = mergeCell(
      flowTo('right'),
      heldFlow('port-top'),
      [],
      0,
      ports,
    );
    expect(merged.cell).toMatchObject({
      target: { cell: 'cell-1', port: 'port-right' },
    });
    expect(merged.ports).toEqual([]);
  });

  it('names a port for the side where the cell declares none there, and asks for it', () => {
    const merged = mergeCell(flowTo('bottom'), undefined, [], 0, ports);
    expect(merged.cell).toMatchObject({
      target: { cell: 'cell-1', port: 'bottom' },
    });
    expect(merged.ports).toEqual([{ cell: 'cell-1', side: 'bottom' }]);
    expect(withNeededPorts([ledger], merged.ports)[0]).toMatchObject({
      ports: {
        groups: { bottom: { position: 'bottom' } },
        items: [
          { group: 'top', id: 'port-top' },
          { group: 'right', id: 'port-right' },
          { group: 'bottom', id: 'bottom' },
        ],
      },
    });
  });

  it('writes an unpinned end with no port, since a port reads back as a side', () => {
    expect(
      mergeCell(flowTo(), heldFlow('port-top'), [], 0, ports).cell,
    ).toMatchObject({
      target: { cell: 'cell-1' },
    });
    expect(
      mergeCell(flowTo(), heldFlow('port-top'), [], 0, ports).cell,
    ).not.toHaveProperty('target.port');
  });

  it('maps the direction onto isBidirectional, leaving an absent flag absent while it reads the same', () => {
    expect(
      mergeCell(flowTo('top', true), heldFlow('port-top'), [], 0, ports).cell,
    ).toMatchObject({
      data: { isBidirectional: true },
    });
    expect(
      mergeCell(flowTo(), undefined, [], 0, ports).cell.data,
    ).toMatchObject({ isBidirectional: undefined });
  });
});
