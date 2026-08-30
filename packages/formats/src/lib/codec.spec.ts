import {
  diagramIdSchema,
  parseModel,
  type Model,
  type ParseIssue,
} from '@panoptes/model';
import { Either } from 'effect';
import { z } from 'zod';
import {
  ReadFailure,
  wireDocumentSchema,
  type Codec,
  type ReadResult,
  type WireDocument,
} from './codec.js';
import {
  emptyLossReport,
  isLossless,
  renderLossReport,
  type LossEntry,
} from './loss.js';

const wireSchema = z.looseObject({
  title: z.string(),
  contributors: z.array(z.looseObject({ name: z.string() })),
  diagrams: z.array(diagramIdSchema),
});

const issuesOfError = (error: z.ZodError): ParseIssue[] =>
  error.issues.map((issue) => ({
    path: issue.path.map((key) =>
      typeof key === 'symbol' ? String(key) : key,
    ),
    message: issue.message,
    code: issue.code,
  }));

const toModel = (wire: z.infer<typeof wireSchema>) =>
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
): Either.Either<ReadResult, ReadFailure> => {
  const document = wireDocumentSchema.safeParse(value);
  if (!document.success) {
    return Either.left(
      ReadFailure.InvalidWireDocument({
        issues: issuesOfError(document.error),
      }),
    );
  }
  const wire = wireSchema.safeParse(document.data);
  if (!wire.success) {
    return Either.left(
      ReadFailure.InvalidWireDocument({ issues: issuesOfError(wire.error) }),
    );
  }
  return Either.mapBoth(toModel(wire.data), {
    onLeft: (failure) => ReadFailure.InvalidModel({ issues: failure.issues }),
    onRight: (model) => ({ model, source: document.data }),
  });
};

const unrepresentableMark: LossEntry = {
  subject: { kind: 'model' },
  dropped: 'the last issued threat number',
  reason: 'unrepresentable',
};

const rewrittenContributors: LossEntry = {
  subject: { kind: 'model' },
  dropped: 'what the source held on each contributor beyond the name',
  reason: 'discarded-by-edit',
};

const sameNames = (
  held: readonly string[],
  wanted: readonly string[],
): boolean =>
  held.length === wanted.length &&
  held.every((name, index) => name === wanted[index]);

const asContributors = (model: Model): WireDocument[] =>
  model.metadata.contributors.map((name) => ({ name }));

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
        }),
        loss: [unrepresentableMark],
      };
    }
    const held = wireSchema.safeParse(source);
    const contributorsHold =
      held.success &&
      sameNames(
        held.data.contributors.map((contributor) => contributor.name),
        model.metadata.contributors,
      );
    const kept = new Set<string>(diagrams);
    const removed = (held.success ? held.data.diagrams : []).filter(
      (id) => !kept.has(id),
    );
    return {
      output: JSON.stringify({
        ...source,
        title: model.metadata.title,
        diagrams,
        ...(contributorsHold ? {} : { contributors: asContributors(model) }),
      }),
      loss: [
        ...removed.map((id): LossEntry => ({
          subject: { kind: 'diagram', id },
          dropped: 'the diagram the source document held',
          reason: 'discarded-by-edit',
        })),
        ...(contributorsHold ? [] : [rewrittenContributors]),
      ],
    };
  },
};

const document: WireDocument = {
  title: 'Order service',
  contributors: [{ name: 'Alexandra', handle: 'alexa' }],
  diagrams: ['diagram-main'],
  layout: { zOrder: ['cell-a', 'cell-b'] },
};

const text = JSON.stringify(document);

const readOrThrow = (input: string): ReadResult =>
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

const documentOf = (output: string): WireDocument =>
  wireDocumentSchema.parse(JSON.parse(output) as unknown);

describe('a codec read', () => {
  it('returns the model together with the document it was mapped from', () => {
    const result = readOrThrow(text);
    expect(result.model.metadata.title).toBe('Order service');
    expect(result.model.metadata.contributors).toEqual(['Alexandra']);
  });

  it('returns that document raw, keeping what the wire schema never declared', () => {
    expect(readOrThrow(text).source).toEqual(document);
  });

  it('refuses text the format cannot parse at all', () => {
    const failure = failureOf('{');
    expect(failure._tag).toBe('MalformedText');
    expect(issuesOf(failure)).toEqual([]);
  });

  it('refuses a text that parses to something other than a document', () => {
    expect(failureOf('5')._tag).toBe('InvalidWireDocument');
  });

  it('refuses a document the wire schema rejects, pathed into that document', () => {
    const failure = failureOf(
      JSON.stringify({ ...document, contributors: 'Alexandra' }),
    );
    expect(failure._tag).toBe('InvalidWireDocument');
    expect(issuesOf(failure)).toContainEqual(
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
      contributors: [{ name: 'Alexandra' }],
      diagrams: ['diagram-main'],
    });
    expect(renderLossReport(result.loss)).toBe(
      'model: the last issued threat number (no place in the format)',
    );
  });

  it('rewrites a mapped field only where the edit changed it, and says what that cost', () => {
    const { source } = readOrThrow(text);
    const { model } = readOrThrow(
      JSON.stringify({ ...document, contributors: [{ name: 'Bo' }] }),
    );
    const result = standIn.write(model, source);
    expect(documentOf(result.output)).toEqual({
      ...document,
      contributors: [{ name: 'Bo' }],
    });
    expect(renderLossReport(result.loss)).toBe(
      'model: what the source held on each contributor beyond the name (removed by an edit)',
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
