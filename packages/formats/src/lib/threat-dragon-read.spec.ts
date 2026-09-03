import type { threatDragonWireSchema } from '@panoptes/wire-threat-dragon';
import { Either } from 'effect';
import { readFailureIssues, ReadFailure, type ReadResult } from './codec.js';
import { renderDivergences } from './divergence.js';
import { readThreatDragon } from './threat-dragon-read.js';
import {
  complementFixture,
  ecluseModel,
  ecluseText,
  minimalFixture,
  unmodelledFixture,
} from './threat-dragon.fixtures.js';

const readOrThrow = (text: string): ReadResult<typeof threatDragonWireSchema> =>
  Either.getOrThrowWith(
    readThreatDragon(text),
    (failure) =>
      new Error(`The Threat Dragon codec refused a text: ${failure._tag}`),
  );

const failureOf = (text: string): ReadFailure =>
  Either.match(readThreatDragon(text), {
    onLeft: (failure) => failure,
    onRight: () => {
      throw new Error('The codec accepted a text it must refuse.');
    },
  });

const tally = (values: readonly string[]): Record<string, number> =>
  values.reduce<Record<string, number>>(
    (counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }),
    {},
  );

const nested = (depth: number): string =>
  `${'{"deeper":'.repeat(depth)}1${'}'.repeat(depth)}`;

const ecluse = readOrThrow(ecluseText);
const complement = readOrThrow(JSON.stringify(complementFixture));
const minimal = readOrThrow(JSON.stringify(minimalFixture));
const unmodelled = readOrThrow(JSON.stringify(unmodelledFixture));

const ecluseElements = ecluse.model.diagrams.flatMap(
  (diagram) => diagram.elements,
);

const complementElements = complement.model.diagrams[0]?.elements ?? [];

const elementNamed = (id: string) =>
  complementElements.find((element) => element.id === id);

describe('reading the Écluse threat model', () => {
  it('lands every cell of the source diagram, 38 over five kinds', () => {
    expect(ecluse.model.diagrams).toHaveLength(1);
    expect(tally(ecluseElements.map((element) => element.kind))).toEqual({
      actor: 4,
      process: 5,
      store: 6,
      flow: 20,
      'trust-boundary': 3,
    });
  });

  it('lands every threat the cells nest, 29 across 13 elements', () => {
    expect(ecluse.model.threats).toHaveLength(29);
    expect(
      new Set(ecluse.model.threats.flatMap((threat) => threat.elements)).size,
    ).toBe(13);
  });

  it('takes the metadata from the summary, one contributor flattened', () => {
    expect(ecluse.model.metadata.title).toBe('Écluse');
    expect(ecluse.model.metadata.owner).toBe('Alexandra de Wit');
    expect(ecluse.model.metadata.description).toContain('STRIDE threat model');
    expect(ecluse.model.metadata.contributors).toEqual(['Alexandra de Wit']);
  });

  it('names a diagram by the number Threat Dragon gives it', () => {
    expect(ecluse.model.diagrams[0]?.id).toBe('0');
    expect(ecluse.model.diagrams[0]?.title).toBe('High Level');
  });

  it('issues up to 102, the greater of threatTop 28 and its own highest', () => {
    expect(ecluse.model.lastIssuedThreatNumber).toBe(102);
  });

  it('reads the statuses the source uses, Accepted among them', () => {
    expect(tally(ecluse.model.threats.map((threat) => threat.status))).toEqual({
      mitigated: 19,
      open: 7,
      'accepted-risk': 3,
    });
  });

  it('reads the severities and the STRIDE categories the source uses', () => {
    expect(
      tally(ecluse.model.threats.map((threat) => threat.severity)),
    ).toEqual({ high: 14, medium: 12, low: 2, critical: 1 });
    expect(
      tally(ecluse.model.threats.map((threat) => threat.category.category)),
    ).toEqual({
      'elevation-of-privilege': 7,
      tampering: 6,
      'denial-of-service': 6,
      'information-disclosure': 5,
      spoofing: 4,
      repudiation: 1,
    });
  });

  it('keeps the one flow endpoint the source leaves on empty canvas', () => {
    const free = ecluseElements.filter(
      (element) =>
        element.kind === 'flow' &&
        (element.source.kind === 'free' || element.target.kind === 'free'),
    );
    expect(free.map((element) => element.name)).toEqual([
      'OSV Dataset for Supported Registries',
    ]);
  });

  it('keeps the one flow the source routes through a waypoint', () => {
    const routed = ecluseElements.filter(
      (element) => element.kind === 'flow' && element.waypoints.length > 0,
    );
    expect(
      routed.map((element) => element.kind === 'flow' && element.waypoints),
    ).toEqual([[{ x: 1180, y: 1065 }]]);
  });

  it('lands as the expected internal model, compared as one value', () => {
    expect(ecluse.model).toStrictEqual(ecluseModel);
  });

  it('diverges in nothing, so the schema declares every key it holds', () => {
    expect(ecluse.divergences).toEqual([]);
  });

  it('returns the document whole, for a write to merge onto', () => {
    expect(ecluse.source).toEqual(JSON.parse(ecluseText) as unknown);
  });
});

describe('reading what the Écluse file has no example of', () => {
  it('draws a boundary curve through its endpoints and its vertices', () => {
    const curve = elementNamed('boundary-curve');
    expect(curve?.kind === 'trust-boundary' && curve.shape).toEqual({
      kind: 'curve',
      waypoints: [
        { x: 0, y: 0 },
        { x: 20, y: 10 },
        { x: 40, y: 40 },
      ],
    });
  });

  it('reads the curve shape name Threat Dragon itself misspells', () => {
    const curve = elementNamed('boundary-typo');
    expect(curve?.kind === 'trust-boundary' && curve.shape.kind).toBe('curve');
  });

  it('names a boundary from its data, or from the label, or not at all', () => {
    expect(elementNamed('boundary-curve')?.name).toBe('Operator zone');
    expect(elementNamed('boundary-typo')?.name).toBe('');
    expect(ecluseElements[0]?.name).toBe(
      'Operator trust zone (VPC / mesh): access edge enforced here',
    );
  });

  it('joins one threat nested under two cells into one record', () => {
    expect(
      complement.model.threats.map((threat) => [threat.id, threat.elements]),
    ).toEqual([
      ['threat-linkability', ['actor-1', 'store-1']],
      ['threat-ethics', ['store-1']],
    ]);
  });

  it('carries a methodology the model does not enumerate as custom', () => {
    expect(complement.model.threats.map((threat) => threat.category)).toEqual([
      { methodology: 'LINDDUN', category: 'linking' },
      {
        methodology: 'custom',
        methodologyName: 'PLOT4ai',
        category: 'Ethics & Human Rights',
      },
    ]);
  });

  it('credits a contributor the file names with an entry and no name', () => {
    expect(complement.model.metadata.contributors).toEqual([
      'Alexandra de Wit',
      '',
    ]);
  });

  it('reads a diagram that holds no cells at all', () => {
    expect(complement.model.diagrams[1]).toEqual({
      id: '5',
      title: 'Nothing drawn yet',
      elements: [],
    });
  });

  it('takes the model default for every field the file leaves out', () => {
    expect(elementNamed('store-1')).toEqual({
      kind: 'store',
      id: 'store-1',
      name: '',
      description: '',
      outOfScope: false,
      reasonOutOfScope: '',
      position: { x: 200, y: 0 },
      size: { width: 100, height: 60 },
    });
    expect(minimal.model).toEqual({
      metadata: {
        title: 'Nothing but a title',
        owner: '',
        description: '',
        contributors: [],
      },
      diagrams: [],
      threats: [],
      lastIssuedThreatNumber: 0,
      mitigations: [],
      assumptions: [],
    });
  });
});

describe('reading what the model has only just grown a home for', () => {
  it('reads a text block as a note on the canvas, its content its text', () => {
    expect(unmodelled.model.diagrams[0]?.elements[0]).toEqual({
      kind: 'text',
      id: 'text-1',
      name: '',
      description: '',
      outOfScope: false,
      reasonOutOfScope: '',
      position: { x: 0, y: 0 },
      size: { width: 200, height: 100 },
      text: 'Arbitrary Text',
    });
  });

  it('issues a number above the mark to a threat the file left unnumbered', () => {
    expect(
      unmodelled.model.threats.map((threat) => [threat.id, threat.number]),
    ).toEqual([
      ['threat-translated', 5],
      ['threat-unplaceable', 6],
      ['threat-card', 4],
    ]);
    expect(unmodelled.model.lastIssuedThreatNumber).toBe(6);
  });

  it('recovers a category its author wrote in another language', () => {
    expect(unmodelled.model.threats[0]?.category).toEqual({
      methodology: 'STRIDE',
      category: 'tampering',
    });
    expect(unmodelled.model.threats[0]?.severity).toBe('undecided');
    expect(unmodelled.model.threats[0]?.status).toBe('accepted-risk');
  });

  it('reports what the model holds less exactly than the file said it', () => {
    expect(renderDivergences(unmodelled.divergences).split('\n')).toEqual([
      'threat "threat-unplaceable": the status "Deferred", which the model has no state for (reduced to fit the format)',
      'threat "threat-unplaceable": the severity "Catastrophic", which the model has no level for (reduced to fit the format)',
      'threat "threat-unplaceable": the category "F\u00e4lschung", which no language of Threat Dragon\'s names (reduced to fit the format)',
      'threat "threat-card": the Elevation of Privilege card, of which the model holds the suit alone (reduced to fit the format)',
    ]);
  });
});

describe('a Threat Dragon read that stops', () => {
  it('refuses text that is not JSON at all', () => {
    const failure = failureOf('{');
    expect(failure._tag).toBe('MalformedText');
    expect(readFailureIssues(failure)).toEqual([]);
  });

  it('refuses a version outside the major it reads', () => {
    const failure = failureOf(
      JSON.stringify({ ...minimalFixture, version: '1.9.9' }),
    );
    expect(failure._tag).toBe('InvalidWireDocument');
    expect(readFailureIssues(failure)).toContainEqual(
      expect.objectContaining({ path: ['version'] }),
    );
  });

  it('refuses a document the wire schema rejects, pathed into the file', () => {
    const failure = failureOf(
      JSON.stringify({
        version: '2.6.2',
        summary: { title: 'Broken' },
        detail: { diagrams: [{ id: 0, title: 'One', diagramType: 'STRIDE' }] },
      }).replace('"diagramType":"STRIDE"', '"diagramType":""'),
    );
    expect(failure._tag).toBe('InvalidWireDocument');
    expect(readFailureIssues(failure)).toContainEqual(
      expect.objectContaining({
        path: ['detail', 'diagrams', 0, 'diagramType'],
      }),
    );
  });

  it('refuses a one-character cell id at the file, not at the model', () => {
    const failure = failureOf(
      JSON.stringify({
        version: '2.6.2',
        summary: { title: 'Shortened' },
        detail: {
          diagrams: [
            {
              id: 0,
              title: 'One',
              diagramType: 'STRIDE',
              cells: [
                {
                  id: 'a',
                  shape: 'process',
                  position: { x: 0, y: 0 },
                  size: { width: 100, height: 100 },
                  data: { type: 'tm.Process' },
                },
              ],
            },
          ],
        },
      }),
    );
    expect(failure._tag).toBe('InvalidWireDocument');
    expect(readFailureIssues(failure)).toContainEqual(
      expect.objectContaining({
        path: ['detail', 'diagrams', 0, 'cells', 0, 'id'],
      }),
    );
  });

  it('refuses a mapping parseModel rejects, pathed into the model', () => {
    const failure = failureOf(
      JSON.stringify({
        version: '2.6.2',
        summary: { title: 'Dangling' },
        detail: {
          diagrams: [
            {
              id: 0,
              title: 'One',
              diagramType: 'STRIDE',
              cells: [
                {
                  id: 'flow-1',
                  shape: 'flow',
                  data: { type: 'tm.Flow' },
                  source: { cell: 'nobody' },
                  target: { cell: 'nobody' },
                },
              ],
            },
          ],
        },
      }),
    );
    expect(failure._tag).toBe('InvalidModel');
    expect(readFailureIssues(failure)).toContainEqual(
      expect.objectContaining({
        path: ['diagrams', 0, 'elements', 0, 'source', 'element'],
      }),
    );
  });

  it('returns a failure rather than throwing on a text nested past any stack', () => {
    expect(
      Either.isLeft(readThreatDragon(`${'['.repeat(3000)}${']'.repeat(3000)}`)),
    ).toBe(true);
  });
});

describe('a Threat Dragon read that strips a key', () => {
  it('reports what the wire schema did not declare, and where it sat', () => {
    const result = readOrThrow(
      JSON.stringify({
        ...minimalFixture,
        summary: { ...minimalFixture.summary, mystery: 'held by no schema' },
      }),
    );
    expect(renderDivergences(result.divergences)).toBe(
      'model: the key summary.mystery (not declared by the wire schema)',
    );
  });

  it('reports a stripped value without walking into it', () => {
    const result = readOrThrow(
      `{"version":"2.6.2","summary":{"title":""},"detail":{"diagrams":[]},"mystery":${nested(8)}}`,
    );
    expect(renderDivergences(result.divergences)).toBe(
      'model: the key mystery (not declared by the wire schema)',
    );
  });
});
