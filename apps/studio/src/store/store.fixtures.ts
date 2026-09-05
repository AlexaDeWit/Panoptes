import {
  diagramIdSchema,
  elementIdSchema,
  parseModel,
  threatIdSchema,
  type DiagramId,
  type Element,
  type ElementId,
  type Model,
  type Threat,
  type ThreatId,
} from '@panoptes/model';
import { threatDragonCodec } from '@panoptes/formats';
import { Either } from 'effect';
import type { RetainedSource } from './state.js';

/**
 * A file in the native format that retained no document, which is what a
 * save into a format a model was not read from has to merge onto.
 */
export const nativeSource: RetainedSource = {
  format: 'panoptes-yaml',
  document: undefined,
};

const foreignText = JSON.stringify({
  version: '2.0',
  summary: { title: 'Store fixture' },
  detail: {
    diagrams: [
      {
        id: 0,
        title: 'Main',
        diagramType: 'STRIDE',
        cells: [
          {
            id: 'actor-reader',
            shape: 'actor',
            position: { x: 0, y: 0 },
            size: { width: 120, height: 60 },
            data: {
              type: 'tm.Actor',
              name: 'Reader',
              threats: [
                {
                  id: 'threat-tampering',
                  number: 1,
                  title: 'A reader edits a model they may only read',
                  modelType: 'STRIDE',
                  type: 'Tampering',
                  status: 'Open',
                  severity: 'Medium',
                  description: '',
                  mitigation: '',
                },
              ],
            },
          },
        ],
      },
    ],
  },
});

/**
 * A file in the format the studio reads Threat Dragon's files as, carrying
 * the document a real read produced rather than none. The purity spec clones
 * the state it is in, which is what holds the store README's rule that
 * nothing but plain data goes there, so the field this document sits in is
 * covered by the clone rather than only by its type.
 */
export const foreignSource: RetainedSource = {
  format: 'threat-dragon',
  document: Either.getOrThrowWith(
    threatDragonCodec.read(foreignText),
    () => new Error('The Threat Dragon fixture no longer reads.'),
  ).source,
};

/** Parses a spec's literal string into a branded element id. */
export const elementId = (value: string): ElementId =>
  elementIdSchema.parse(value);

/** Parses a spec's literal string into a branded diagram id. */
export const diagramId = (value: string): DiagramId =>
  diagramIdSchema.parse(value);

/** Parses a spec's literal string into a branded threat id. */
export const threatId = (value: string): ThreatId =>
  threatIdSchema.parse(value);

/** The diagram every fixture element belongs to. */
export const mainDiagram = diagramId('diagram-main');

/** The actor the fixture threat is attached to. */
export const actorElement = elementId('actor-reader');

/** The process the fixture leaves unthreatened. */
export const processElement = elementId('process-studio');

/** The store the fixture leaves unthreatened. */
export const storeElement = elementId('store-models');

/** The one threat the fixture register holds. */
export const firstThreat = threatId('threat-tampering');

const document = {
  metadata: {
    title: 'Store fixture',
    owner: 'Panoptes',
    description: '',
    contributors: [],
  },
  diagrams: [
    {
      id: mainDiagram,
      title: 'Main',
      elements: [
        {
          kind: 'actor',
          id: actorElement,
          name: 'Reader',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 0, y: 0 },
          size: { width: 120, height: 60 },
        },
        {
          kind: 'process',
          id: processElement,
          name: 'Studio',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 200, y: 0 },
          size: { width: 120, height: 60 },
        },
        {
          kind: 'store',
          id: storeElement,
          name: 'Models',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 400, y: 0 },
          size: { width: 120, height: 60 },
        },
      ],
    },
  ],
  threats: [
    {
      id: firstThreat,
      number: 1,
      title: 'A reader edits a model they may only read',
      category: { methodology: 'STRIDE', category: 'tampering' },
      severity: 'medium',
      status: 'open',
      description: '',
      mitigation: '',
      elements: [actorElement],
    },
  ],
  lastIssuedThreatNumber: 1,
  mitigations: [],
  assumptions: [],
};

/**
 * The parsed form of a fixture, for a spec that needs a Model. Throws where
 * the fixture stops parsing: a fixture that no longer parses is a broken
 * suite rather than a case under test, and the message names what it lost.
 */
export function parsedFixture(input: unknown): Model {
  return Either.getOrThrowWith(
    parseModel(input),
    (failure) =>
      new Error(
        `Fixture does not parse: ${failure.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      ),
  );
}

/**
 * The model the store specs edit: one diagram of three elements and a
 * register of one threat, small enough that a spec names every id it
 * touches.
 */
export const sampleModel: Model = parsedFixture(document);

/** The fixture threat, as the register holds it. */
export const sampleThreat: Threat = sampleModel.threats[0];

/** A process the specs add, named by the caller so ids stay distinct. */
export function newProcess(id: string, name: string): Element {
  return {
    kind: 'process',
    id: elementId(id),
    name,
    description: '',
    outOfScope: false,
    reasonOutOfScope: '',
    position: { x: 0, y: 200 },
    size: { width: 120, height: 60 },
  };
}
