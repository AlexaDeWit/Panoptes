import { toParseIssues, type ParseIssue } from '@panoptes/model';
import { threatDragonWireSchema } from './threat-dragon-wire.js';
import {
  ecluseText,
  minimalFixture,
  unmodelledFixture,
} from './threat-dragon.fixtures.js';
import { undeclaredDivergences } from './undeclared.js';

const ecluseDocument = JSON.parse(ecluseText) as unknown;

const issuesOf = (given: unknown): readonly ParseIssue[] => {
  const result = threatDragonWireSchema.safeParse(given);
  if (result.success) {
    throw new Error('The wire schema accepted a document it must refuse.');
  }
  return toParseIssues(result.error.issues);
};

const withDiagram = (diagram: unknown): unknown => ({
  ...minimalFixture,
  detail: { diagrams: [diagram] },
});

const unmodelled = threatDragonWireSchema.parse(unmodelledFixture);

const threatBearer = unmodelled.detail.diagrams[0]?.cells?.find(
  (cell) => cell.shape === 'process',
);

const threatsOfFixture = threatBearer?.data.threats ?? [];

const cardThreat = threatsOfFixture.find(
  (threat) => threat.modelType === 'EOP',
);

describe('threatDragonWireSchema', () => {
  it('declares every key the Écluse file holds, dropping none of it', () => {
    expect(threatDragonWireSchema.parse(ecluseDocument)).toEqual(
      ecluseDocument,
    );
  });

  it('drops a key it does not declare rather than refusing the file', () => {
    const given = { ...minimalFixture, mystery: 'a later Threat Dragon' };
    const kept = threatDragonWireSchema.parse(given);
    expect(kept).toEqual(minimalFixture);
    expect(undeclaredDivergences(given, kept)).toHaveLength(1);
  });

  it('refuses a file stamped outside the major it reads', () => {
    expect(issuesOf({ ...minimalFixture, version: '1.6.2' })).toContainEqual(
      expect.objectContaining({ path: ['version'] }),
    );
    expect(
      issuesOf(
        withDiagram({
          id: 0,
          title: 'One',
          diagramType: 'STRIDE',
          version: '3.0.0',
        }),
      ),
    ).toContainEqual(
      expect.objectContaining({ path: ['detail', 'diagrams', 0, 'version'] }),
    );
  });

  it('reads a text block, the cell kind the model has no element for', () => {
    const given = JSON.parse(JSON.stringify(unmodelledFixture)) as unknown;
    expect(undeclaredDivergences(given, unmodelled)).toEqual([]);
    expect(unmodelled.detail.diagrams[0]?.cells?.[0]?.shape).toBe(
      'td-text-block',
    );
  });

  it('reads a threat with no number, an unlisted severity, and a translated category', () => {
    const threat = threatsOfFixture[0];
    expect(threat?.number).toBeUndefined();
    expect(threat?.severity).toBe('TBA');
    expect(threat?.type).toBe('Manipulation');
  });

  it('reads an EOP threat, whose type is null and whose card is its identity', () => {
    expect(cardThreat).toMatchObject({
      modelType: 'EOP',
      type: null,
      eopGameId: 'cornucopia',
      cardSuit: 'Data Validation & Encoding',
      cardNumber: '3',
    });
  });

  it('reads the two-part version Threat Dragon writes as well as the three', () => {
    expect(unmodelled.version).toBe('2.0');
    expect(threatDragonWireSchema.parse(minimalFixture).version).toBe('2.9.13');
  });
});
