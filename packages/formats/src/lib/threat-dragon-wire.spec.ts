import { toParseIssues, type ParseIssue } from '@panoptes/model';
import { threatDragonWireSchema } from './threat-dragon-wire.js';
import { ecluseText, minimalFixture } from './threat-dragon.fixtures.js';
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

const withCell = (cell: unknown): unknown =>
  withDiagram({ id: 0, title: 'One', diagramType: 'STRIDE', cells: [cell] });

const withThreat = (threat: unknown): unknown =>
  withCell({
    id: 'actor-1',
    shape: 'actor',
    position: { x: 0, y: 0 },
    size: { width: 10, height: 10 },
    data: { type: 'tm.Actor', threats: [threat] },
  });

const strideThreat = {
  id: 'threat-1',
  number: 1,
  title: '',
  modelType: 'STRIDE',
  type: 'Spoofing',
  status: 'Open',
  severity: 'Low',
  description: '',
  mitigation: '',
};

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

  it('refuses a category a methodology does not admit', () => {
    expect(
      issuesOf(withThreat({ ...strideThreat, type: 'Linkability' })),
    ).toContainEqual(
      expect.objectContaining({
        path: [
          'detail',
          'diagrams',
          0,
          'cells',
          0,
          'data',
          'threats',
          0,
          'type',
        ],
      }),
    );
  });

  it('refuses a cell kind the model has no element for', () => {
    expect(
      issuesOf(
        withCell({
          id: 'text-1',
          shape: 'td-text-block',
          position: { x: 0, y: 0 },
          size: { width: 10, height: 10 },
          data: { type: 'tm.Text' },
        }),
      ),
    ).toContainEqual(
      expect.objectContaining({
        path: ['detail', 'diagrams', 0, 'cells', 0, 'shape'],
      }),
    );
  });

  it('refuses a methodology whose threats carry no category to hold', () => {
    expect(
      issuesOf(withThreat({ ...strideThreat, modelType: 'EOP', type: null })),
    ).toContainEqual(
      expect.objectContaining({
        path: [
          'detail',
          'diagrams',
          0,
          'cells',
          0,
          'data',
          'threats',
          0,
          'modelType',
        ],
      }),
    );
  });
});
