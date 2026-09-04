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
import { Either } from 'effect';

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
 * The model the store specs edit: one diagram of three elements and a
 * register of one threat, small enough that a spec names every id it
 * touches. Throws where the literal stops parsing, a broken fixture being a
 * broken suite rather than a case under test.
 */
export const sampleModel: Model = Either.getOrThrowWith(
  parseModel(document),
  (failure) =>
    new Error(
      `Fixture does not parse: ${failure.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    ),
);

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
