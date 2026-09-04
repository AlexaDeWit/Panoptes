import {
  diagramIdSchema,
  parseModel,
  toParseIssues,
  type Model,
} from '@panoptes/model';
import { Either } from 'effect';
import { z } from 'zod';
import {
  readFailureIssues,
  ReadFailure,
  type Codec,
  type ReadResult,
  type WriteResult,
} from './codec.js';
import {
  hasDiverged,
  noDivergence,
  renderDivergences,
  type Divergence,
} from './divergence.js';
import { undeclaredDivergences } from './undeclared.js';

const wireSchema = z.object({
  title: z.string(),
  contributors: z.array(z.object({ name: z.string(), role: z.string() })),
  diagrams: z.array(diagramIdSchema),
  layout: z.object({ zOrder: z.array(z.string()) }),
});

type Wire = z.infer<typeof wireSchema>;

const toModel = (wire: Wire) =>
  parseModel({
    metadata: {
      title: wire.title,
      owner: '',
      description: '',
      contributors: wire.contributors.map((contributor) => contributor.name),
    },
    diagrams: wire.diagrams.map((id) => ({ id, title: id, elements: [] })),
    threats: [],
    lastIssuedThreatNumber: 0,
    mitigations: [],
    assumptions: [],
  });

const parseText = (text: string): Either.Either<unknown, ReadFailure> =>
  Either.try({
    try: () => JSON.parse(text) as unknown,
    catch: (error) => ReadFailure.MalformedText({ message: String(error) }),
  });

const mapDocument = (
  value: unknown,
): Either.Either<ReadResult<typeof wireSchema>, ReadFailure> => {
  const wire = wireSchema.safeParse(value);
  if (!wire.success) {
    return Either.left(
      ReadFailure.InvalidWireDocument({
        issues: toParseIssues(wire.error.issues),
      }),
    );
  }
  return Either.mapBoth(toModel(wire.data), {
    onLeft: (failure) => ReadFailure.InvalidModel({ issues: failure.issues }),
    onRight: (model) => ({
      model,
      source: wire.data,
      divergences: undeclaredDivergences(value, wire.data),
    }),
  });
};

const unrepresentableMark: Divergence = {
  subject: { kind: 'model' },
  detail: 'the last issued threat number',
  reason: 'unrepresentable',
};

const rewrittenContributors: Divergence = {
  subject: { kind: 'model' },
  detail: 'what the source held on each contributor beyond the name',
  reason: 'discarded-by-edit',
};

const sameNames = (
  held: readonly string[],
  wanted: readonly string[],
): boolean =>
  held.length === wanted.length &&
  held.every((name, index) => name === wanted[index]);

const asContributors = (model: Model): Wire['contributors'] =>
  model.metadata.contributors.map((name) => ({ name, role: '' }));

const standIn: Codec<typeof wireSchema> = {
  wire: wireSchema,
  read: (text) => Either.flatMap(parseText(text), mapDocument),
  write(model, source) {
    const diagrams = model.diagrams.map((diagram) => diagram.id);
    if (!source) {
      return {
        output: JSON.stringify({
          title: model.metadata.title,
          contributors: asContributors(model),
          diagrams,
          layout: { zOrder: [] },
        }),
        divergences: [unrepresentableMark],
      };
    }
    const contributorsHold = sameNames(
      source.contributors.map((contributor) => contributor.name),
      model.metadata.contributors,
    );
    const kept = new Set<string>(diagrams);
    const removed = source.diagrams.filter((id) => !kept.has(id));
    return {
      output: JSON.stringify({
        ...source,
        title: model.metadata.title,
        diagrams,
        ...(contributorsHold ? {} : { contributors: asContributors(model) }),
      }),
      divergences: [
        ...removed.map((id): Divergence => ({
          subject: { kind: 'diagram', id },
          detail: 'the diagram the source document held',
          reason: 'discarded-by-edit',
        })),
        ...(contributorsHold ? [] : [rewrittenContributors]),
      ],
    };
  },
};

const document: Wire = {
  title: 'Order service',
  contributors: [{ name: 'Alexandra', role: 'author' }],
  diagrams: [diagramIdSchema.parse('diagram-main')],
  layout: { zOrder: ['cell-a', 'cell-b'] },
};

const text = JSON.stringify(document);

const readOrThrow = (input: string): ReadResult<typeof wireSchema> =>
  Either.getOrThrowWith(
    standIn.read(input),
    (failure) =>
      new Error(`The stand-in codec refused a text: ${failure._tag}`),
  );

const failureOf = (input: string): ReadFailure =>
  Either.match(standIn.read(input), {
    onLeft: (failure) => failure,
    onRight: () => {
      throw new Error('The stand-in codec accepted a text it must refuse.');
    },
  });

const outputOf = (result: WriteResult): unknown =>
  JSON.parse(result.output) as unknown;

describe('a codec read', () => {
  it('returns the model together with the document it was mapped from', () => {
    const result = readOrThrow(text);
    expect(result.model.metadata.title).toBe('Order service');
    expect(result.model.metadata.contributors).toEqual(['Alexandra']);
    expect(result.source).toEqual(document);
  });

  it('diverges in nothing where the schema declares every key the file holds', () => {
    expect(hasDiverged(readOrThrow(text).divergences)).toBe(false);
  });

  it('strips a key the schema does not declare, and says it did', () => {
    const result = readOrThrow(
      JSON.stringify({ ...document, mystery: 'held by no schema' }),
    );
    expect(result.source).toEqual(document);
    expect(renderDivergences(result.divergences)).toBe(
      'model: the key mystery (not declared by the wire schema)',
    );
  });

  it('names where in the file a stripped key sat', () => {
    const result = readOrThrow(
      JSON.stringify({
        ...document,
        contributors: [{ name: 'Alexandra', role: 'author', handle: 'alexa' }],
        layout: { zOrder: [], grid: 10 },
      }),
    );
    expect(renderDivergences(result.divergences).split('\n')).toEqual([
      'model: the key contributors.0.handle (not declared by the wire schema)',
      'model: the key layout.grid (not declared by the wire schema)',
    ]);
  });

  it('reports a stripped key whose name is a prototype member', () => {
    const inherited = Object.fromEntries<unknown>([
      ['__proto__', { pwn: 1 }],
      ['toString', 'no'],
    ]);
    const result = readOrThrow(JSON.stringify({ ...document, ...inherited }));
    expect(renderDivergences(result.divergences).split('\n')).toEqual([
      'model: the key __proto__ (not declared by the wire schema)',
      'model: the key toString (not declared by the wire schema)',
    ]);
  });

  it('refuses text the format cannot parse at all', () => {
    const failure = failureOf('{');
    expect(failure._tag).toBe('MalformedText');
    expect(readFailureIssues(failure)).toEqual([]);
  });

  it('carries no issues on a text a bound stopped before any document', () => {
    const failure = ReadFailure.ExceededReadLimit({
      limit: 'maxNestingDepth',
      bound: 64,
      observed: 65,
    });
    expect(readFailureIssues(failure)).toEqual([]);
  });

  it('refuses a text that parses to something other than a document', () => {
    expect(failureOf('5')._tag).toBe('InvalidWireDocument');
  });

  it('refuses a document the wire schema rejects, pathed into that document', () => {
    const failure = failureOf(
      JSON.stringify({ ...document, contributors: 'Alexandra' }),
    );
    expect(failure._tag).toBe('InvalidWireDocument');
    expect(readFailureIssues(failure)).toContainEqual(
      expect.objectContaining({ path: ['contributors'] }),
    );
  });

  it('refuses a document that maps to a model parseModel rejects, pathed into the model', () => {
    const failure = failureOf(
      JSON.stringify({
        ...document,
        diagrams: ['diagram-main', 'diagram-main'],
      }),
    );
    expect(failure._tag).toBe('InvalidModel');
    expect(readFailureIssues(failure)).toContainEqual(
      expect.objectContaining({ path: ['diagrams', 1, 'id'] }),
    );
  });

  it('serializes a failure to its plain tagged shape', () => {
    const failure = ReadFailure.InvalidWireDocument({ issues: [] });
    expect(JSON.parse(JSON.stringify(failure)) as unknown).toEqual({
      _tag: 'InvalidWireDocument',
      issues: [],
    });
  });
});

describe('a codec write', () => {
  it('merges an unedited model onto its own source, reporting nothing the model caused', () => {
    const { model, source } = readOrThrow(text);
    const result = standIn.write(model, source);
    expect(hasDiverged(result.divergences)).toBe(false);
    expect(result.divergences).toEqual(noDivergence);
    expect(outputOf(result)).toEqual(document);
  });

  it('projects into canonical form without a source, naming what the format cannot hold', () => {
    const { model } = readOrThrow(text);
    const result = standIn.write(model);
    expect(outputOf(result)).toEqual({
      title: 'Order service',
      contributors: [{ name: 'Alexandra', role: '' }],
      diagrams: ['diagram-main'],
      layout: { zOrder: [] },
    });
    expect(renderDivergences(result.divergences)).toBe(
      'model: the last issued threat number (no place in the format)',
    );
  });

  it('rewrites a mapped field only where the edit changed it, and says what that cost', () => {
    const { source } = readOrThrow(text);
    const { model } = readOrThrow(
      JSON.stringify({
        ...document,
        contributors: [{ name: 'Bo', role: 'author' }],
      }),
    );
    const result = standIn.write(model, source);
    expect(outputOf(result)).toEqual({
      ...document,
      contributors: [{ name: 'Bo', role: '' }],
    });
    expect(renderDivergences(result.divergences)).toBe(
      'model: what the source held on each contributor beyond the name (removed by an edit)',
    );
  });

  it('records what a merge dropped because an edit removed it', () => {
    const { source } = readOrThrow(text);
    const { model } = readOrThrow(
      JSON.stringify({ ...document, diagrams: [] }),
    );
    const result = standIn.write(model, source);
    expect(outputOf(result)).toEqual({ ...document, diagrams: [] });
    expect(renderDivergences(result.divergences)).toBe(
      'diagram "diagram-main": the diagram the source document held (removed by an edit)',
    );
  });
});
