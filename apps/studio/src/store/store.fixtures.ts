import { threatDragonCodec } from '@saerskriven/formats';
import type { Element, ElementId, Model, Threat } from '@saerskriven/model';
import {
  diagramId,
  elementId,
  parsedFixture,
  threatId,
} from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import type { RetainedSource } from './state.js';

/**
 * A file in the native format that retained no document, which is what a
 * save into a format a model was not read from has to merge onto.
 */
export const nativeSource: RetainedSource = {
  format: 'saerskriven-yaml',
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

/** The diagram {@link twoDiagramModel} holds after {@link mainDiagram}. */
export const secondDiagram = diagramId('diagram-second');

/** The one element of {@link secondDiagram}. */
export const otherElement = elementId('actor-other');

const document = {
  metadata: {
    title: 'Store fixture',
    owner: 'Saerskriven',
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
 * The model the store specs edit: one diagram of three elements and a
 * register of one threat, small enough that a spec names every id it
 * touches.
 */
export const sampleModel: Model = parsedFixture(document);

/** The fixture threat, as the register holds it. */
export const sampleThreat: Threat = sampleModel.threats[0];

/**
 * The sample model with a second diagram of one actor after the first, for
 * the specs that switch between diagrams.
 */
export const twoDiagramModel: Model = parsedFixture({
  ...document,
  diagrams: [
    ...document.diagrams,
    {
      id: secondDiagram,
      title: 'Second',
      elements: [
        {
          kind: 'actor',
          id: otherElement,
          name: 'Other reader',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 0, y: 0 },
          size: { width: 120, height: 60 },
        },
      ],
    },
  ],
});

/**
 * One fixture element as the model holds it, for a spec that has the id and
 * needs the record. An id the diagram does not hold gives a process of that
 * id, so a spec naming the wrong one fails on what it asserts rather than on
 * a missing value.
 */
export function sampleElement(id: ElementId): Element {
  return (
    sampleModel.diagrams[0].elements.find((element) => element.id === id) ??
    newProcess(id, 'Missing')
  );
}

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

/** A text note the specs add, which draws prose rather than a name. */
export function newNote(id: string, text: string): Element {
  return {
    kind: 'text',
    id: elementId(id),
    name: '',
    description: '',
    outOfScope: false,
    reasonOutOfScope: '',
    text,
    position: { x: 0, y: 320 },
    size: { width: 200, height: 40 },
  };
}
