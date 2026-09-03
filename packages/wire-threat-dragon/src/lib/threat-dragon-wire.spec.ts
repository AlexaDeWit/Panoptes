import {
  threatDragonWireSchema,
  type ThreatDragonDocument,
  type ThreatDragonThreat,
} from './threat-dragon-wire.js';

const translated: ThreatDragonThreat = {
  id: 'threat-translated',
  title: 'Manipulation der Anfrage',
  modelType: 'STRIDE',
  type: 'Manipulation',
  status: 'Accepted',
  severity: 'TBA',
  description: '',
  mitigation: '',
};

const card: ThreatDragonThreat = {
  id: 'threat-card',
  number: 4,
  title: 'The attacker reads the session token',
  modelType: 'EOP',
  type: null,
  eopGameId: 'cornucopia',
  cardSuit: 'Data Validation & Encoding',
  cardNumber: '3',
  status: 'Open',
  severity: 'TBD',
  description: '',
  mitigation: '',
};

const minimal: ThreatDragonDocument = {
  version: '2.9.13',
  summary: { title: 'Nothing but a title' },
  detail: { diagrams: [] },
};

const unmodelled: ThreatDragonDocument = {
  version: '2.0',
  summary: { title: 'Beyond the model' },
  detail: {
    diagrams: [
      {
        id: 0,
        title: 'Zahlungen',
        diagramType: 'STRIDE',
        version: '2.0',
        cells: [
          {
            id: 'text-1',
            shape: 'td-text-block',
            position: { x: 0, y: 0 },
            size: { width: 200, height: 100 },
            attrs: { text: { text: 'Arbitrary Text' } },
            data: { type: 'tm.Text', name: 'Arbitrary Text' },
          },
          {
            id: 'boundary-typo',
            shape: 'trust-broundary-curve',
            data: { type: 'tm.Boundary' },
            source: { x: 0, y: 60 },
            target: { x: 40, y: 60 },
          },
          {
            id: 'process-1',
            shape: 'process',
            position: { x: 0, y: 200 },
            size: { width: 100, height: 100 },
            data: {
              type: 'tm.Process',
              name: 'Zahlungsdienst',
              threats: [translated, card],
            },
          },
          {
            id: 'flow-1',
            shape: 'flow',
            data: { type: 'tm.Flow' },
            source: { cell: 'process-1' },
            target: { x: 300, y: 300 },
          },
        ],
      },
    ],
  },
};

function parsedOf(value: unknown) {
  const result = threatDragonWireSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

function issuePathsOf(value: unknown) {
  const result = threatDragonWireSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

function withCells(cells: readonly unknown[]): unknown {
  return {
    ...minimal,
    detail: {
      diagrams: [{ id: 0, title: 'One', diagramType: 'STRIDE', cells }],
    },
  };
}

function processCell(id: string, threats: readonly unknown[]): unknown {
  return {
    id,
    shape: 'process',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    data: { type: 'tm.Process', threats },
  };
}

const parsed = parsedOf(unmodelled);

const cellsOfFixture = parsed?.detail.diagrams[0]?.cells ?? [];

const threatsOfFixture = cellsOfFixture.flatMap((cell) =>
  cell.shape === 'process' ? (cell.data.threats ?? []) : [],
);

describe('the Threat Dragon wire schema', () => {
  it('reads a file holding nothing but what the format requires', () => {
    expect(parsedOf(minimal)).toEqual(minimal);
  });

  it('reads what Threat Dragon writes and the model has no home for', () => {
    expect(parsed).toEqual(unmodelled);
  });

  it('reads a threat with no number, an unlisted severity, and a translated category', () => {
    expect(threatsOfFixture[0]?.number).toBeUndefined();
    expect(threatsOfFixture[0]).toMatchObject({
      severity: 'TBA',
      type: 'Manipulation',
    });
  });

  it('reads an EOP threat, whose type is null and whose card is its identity', () => {
    expect(threatsOfFixture[1]).toMatchObject({
      modelType: 'EOP',
      type: null,
      eopGameId: 'cornucopia',
      cardSuit: 'Data Validation & Encoding',
      cardNumber: '3',
    });
  });

  it('reads the curve shape name Threat Dragon itself misspells', () => {
    expect(cellsOfFixture[1]?.shape).toBe('trust-broundary-curve');
  });

  it('reads the two-part version Threat Dragon writes as well as the three', () => {
    expect(parsed?.version).toBe('2.0');
    expect(parsedOf(minimal)?.version).toBe('2.9.13');
  });

  it('refuses a file stamped outside the major it reads, at that path', () => {
    expect(issuePathsOf({ ...minimal, version: '1.6.2' })).toEqual([
      ['version'],
    ]);
    expect(
      issuePathsOf({
        ...minimal,
        detail: {
          diagrams: [
            { id: 0, title: 'One', diagramType: 'STRIDE', version: '3.0.0' },
          ],
        },
      }),
    ).toEqual([['detail', 'diagrams', 0, 'version']]);
  });

  it('drops a key it does not declare rather than refusing the file', () => {
    expect(parsedOf({ ...minimal, mystery: 'a later Threat Dragon' })).toEqual(
      minimal,
    );
  });

  it('refuses a cell id of one character, at that path', () => {
    expect(issuePathsOf(withCells([processCell('a', [])]))).toEqual([
      ['detail', 'diagrams', 0, 'cells', 0, 'id'],
    ]);
  });

  it('refuses a threat id of one character, at that path', () => {
    expect(
      issuePathsOf(
        withCells([processCell('process-1', [{ ...translated, id: 'a' }])]),
      ),
    ).toEqual([
      ['detail', 'diagrams', 0, 'cells', 0, 'data', 'threats', 0, 'id'],
    ]);
  });

  it('refuses an edge anchored to a one-character cell, at that path', () => {
    expect(
      issuePathsOf(
        withCells([
          {
            id: 'flow-1',
            shape: 'flow',
            data: { type: 'tm.Flow' },
            source: { cell: 'a' },
            target: { cell: 'process-1' },
          },
        ]),
      ),
    ).toEqual([['detail', 'diagrams', 0, 'cells', 0, 'source', 'cell']]);
  });
});
