import { parseModel, type Model } from '@panoptes/model';
import { Either } from 'effect';
import { elementId } from '../store/store.fixtures.js';

/** The actor the fixture threat is attached to. */
export const readerElement = elementId('actor-reader');

/** The process the reader's flow points at. */
export const studioElement = elementId('process-studio');

/** The flow between the two, which the fixture threat also names. */
export const requestFlow = elementId('flow-request');

/** The flow whose target belongs to no element. */
export const probeFlow = elementId('flow-probe');

const document = {
  metadata: {
    title: 'Canvas fixture',
    owner: 'Panoptes',
    description: '',
    contributors: [],
  },
  diagrams: [
    {
      id: 'diagram-main',
      title: 'Main',
      elements: [
        {
          kind: 'actor',
          id: readerElement,
          name: 'Reader',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 0, y: 0 },
          size: { width: 120, height: 60 },
        },
        {
          kind: 'process',
          id: studioElement,
          name: 'Studio',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 300, y: 0 },
          size: { width: 120, height: 60 },
        },
        {
          kind: 'flow',
          id: requestFlow,
          name: 'Opens a model',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'attached', element: readerElement },
          target: { kind: 'attached', element: studioElement },
          waypoints: [],
        },
        {
          kind: 'flow',
          id: probeFlow,
          name: 'Reads a file',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'attached', element: studioElement },
          target: { kind: 'free', position: { x: 500, y: 200 } },
          waypoints: [],
        },
      ],
    },
  ],
  threats: [
    {
      id: 'threat-tampering',
      number: 1,
      title: 'A reader edits a model they may only read',
      category: { methodology: 'STRIDE', category: 'tampering' },
      severity: 'medium',
      status: 'open',
      description: '',
      mitigation: '',
      elements: [readerElement],
    },
    {
      id: 'threat-disclosure',
      number: 2,
      title: 'A model is read from a path the studio should not reach',
      category: { methodology: 'STRIDE', category: 'information-disclosure' },
      severity: 'undecided',
      status: 'open',
      description: '',
      mitigation: '',
      elements: [requestFlow],
    },
  ],
  lastIssuedThreatNumber: 2,
  mitigations: [],
  assumptions: [],
};

/**
 * The model the canvas specs draw: two elements, a flow between them, a flow
 * ending at a position that belongs to no element, and a threat on each of
 * the two things a name has to account for. Throws where the literal stops
 * parsing, a broken fixture being a broken suite rather than a case under
 * test.
 */
export const canvasModel: Model = Either.getOrThrowWith(
  parseModel(document),
  (failure) =>
    new Error(
      `Fixture does not parse: ${failure.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    ),
);
