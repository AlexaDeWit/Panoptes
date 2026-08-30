import { diagramIdSchema, parseModel, type ParseIssue } from '@panoptes/model';
import { Either } from 'effect';
import { z } from 'zod';
import { ReadFailure, type Codec, type ReadResult } from './codec.js';
import {
  emptyLossReport,
  isLossless,
  renderLossReport,
  type LossEntry,
} from './loss.js';

const wireSchema = z.strictObject({
  title: z.string(),
  diagrams: z.array(z.string()),
  layout: z.strictObject({ zOrder: z.array(z.string()) }),
});

type Wire = z.infer<typeof wireSchema>;

const issuesOfError = (error: z.ZodError): ParseIssue[] =>
  error.issues.map((issue) => ({
    path: issue.path.map((key) =>
      typeof key === 'symbol' ? String(key) : key,
    ),
    message: issue.message,
    code: issue.code,
  }));

const toModel = (wire: Wire) =>
  parseModel({
    metadata: {
      title: wire.title,
      owner: '',
      description: '',
      contributors: [],
    },
    diagrams: wire.diagrams.map((id) => ({ id, title: id, elements: [] })),
    threats: [],
    lastIssuedThreatNumber: 0,
    mitigations: [],
    assumptions: [],
  });

const unrepresentableZOrder: LossEntry = {
  subject: { kind: 'model' },
  dropped: 'the z-order the format keeps outside the model',
  reason: 'unrepresentable',
};

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
      ReadFailure.InvalidWireDocument({ issues: issuesOfError(wire.error) }),
    );
  }
  return Either.mapBoth(toModel(wire.data), {
    onLeft: (failure) => ReadFailure.InvalidModel({ issues: failure.issues }),
    onRight: (model) => ({ model, source: wire.data }),
  });
};

const standIn: Codec<typeof wireSchema> = {
  wire: wireSchema,
  read: (text) => Either.flatMap(parseText(text), mapDocument),
  write(model, source) {
    const diagrams = model.diagrams.map((diagram) => diagram.id);
    if (!source) {
      return {
        output: JSON.stringify({
          title: model.metadata.title,
          diagrams,
          layout: { zOrder: [] },
        }),
        loss: [unrepresentableZOrder],
      };
    }
    const kept = new Set<string>(diagrams);
    return {
      output: JSON.stringify({
        ...source,
        title: model.metadata.title,
        diagrams,
      }),
      loss: source.diagrams
        .filter((id) => !kept.has(id))
        .map((id): LossEntry => ({
          subject: { kind: 'diagram', id: diagramIdSchema.parse(id) },
          dropped: 'the diagram the source document held',
          reason: 'discarded-by-edit',
        })),
    };
  },
};

const document: Wire = {
  title: 'Order service',
  diagrams: ['diagram-main'],
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

const issuesOf = (failure: ReadFailure): readonly ParseIssue[] =>
  ReadFailure.$is('MalformedText')(failure) ? [] : failure.issues;

const documentOf = (output: string): Wire =>
  wireSchema.parse(JSON.parse(output) as unknown);

describe('a codec read', () => {
  it('returns the model together with the wire document it was mapped from', () => {
    const result = readOrThrow(text);
    expect(result.model.metadata.title).toBe('Order service');
    expect(result.source).toEqual(document);
  });

  it('refuses text the format cannot parse at all', () => {
    const failure = failureOf('{');
    expect(failure._tag).toBe('MalformedText');
    expect(issuesOf(failure)).toEqual([]);
  });

  it('refuses a document the wire schema rejects, pathed into that document', () => {
    const failure = failureOf(
      JSON.stringify({ ...document, layout: { zOrder: 'cell-a' } }),
    );
    expect(failure._tag).toBe('InvalidWireDocument');
    expect(issuesOf(failure)).toContainEqual(
      expect.objectContaining({ path: ['layout', 'zOrder'] }),
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
    expect(issuesOf(failure)).toContainEqual(
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
  it('merges an unedited model onto its own source and reports no loss', () => {
    const { model, source } = readOrThrow(text);
    const result = standIn.write(model, source);
    expect(isLossless(result.loss)).toBe(true);
    expect(result.loss).toEqual(emptyLossReport);
    expect(documentOf(result.output)).toEqual(document);
  });

  it('projects into canonical form without a source, naming what the format cannot hold', () => {
    const { model } = readOrThrow(text);
    const result = standIn.write(model);
    expect(documentOf(result.output)).toEqual({
      title: 'Order service',
      diagrams: ['diagram-main'],
      layout: { zOrder: [] },
    });
    expect(renderLossReport(result.loss)).toBe(
      'model: the z-order the format keeps outside the model (no place in the format)',
    );
  });

  it('records what a merge dropped because an edit removed it', () => {
    const { source } = readOrThrow(text);
    const { model } = readOrThrow(
      JSON.stringify({ ...document, diagrams: [] }),
    );
    const result = standIn.write(model, source);
    expect(documentOf(result.output).diagrams).toEqual([]);
    expect(renderLossReport(result.loss)).toBe(
      'diagram "diagram-main": the diagram the source document held (removed by an edit)',
    );
  });
});
