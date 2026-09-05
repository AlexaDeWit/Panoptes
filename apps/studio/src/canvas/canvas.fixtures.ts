import type { Model } from '@panoptes/model';
import { elementId, parsedFixture } from '@panoptes/model/fixtures';

/** The actor the fixture threat is attached to. */
export const readerElement = elementId('actor-reader');

/** The process the reader's flow points at. */
export const studioElement = elementId('process-studio');

/** The flow between the two, which the fixture threat also names. */
export const requestFlow = elementId('flow-request');

/** The flow whose target belongs to no element. */
export const probeFlow = elementId('flow-probe');

/** The trust boundary drawn around the two, which no flow ends on. */
export const boundaryElement = elementId('boundary-perimeter');

/** The note beside them, which no flow ends on either. */
export const noteElement = elementId('text-note');

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
          kind: 'trust-boundary',
          id: boundaryElement,
          name: 'Perimeter',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          shape: {
            kind: 'box',
            position: { x: -20, y: -20 },
            size: { width: 460, height: 100 },
          },
        },
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
          kind: 'text',
          id: noteElement,
          name: 'Note',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          text: 'The studio opens on this model.',
          position: { x: 0, y: 200 },
          size: { width: 200, height: 40 },
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
    {
      id: 'threat-repudiation',
      number: 3,
      title: 'An edit is attributed to a reader who did not make it',
      category: { methodology: 'STRIDE', category: 'repudiation' },
      severity: 'undecided',
      status: 'open',
      description: '',
      mitigation: '',
      elements: [requestFlow],
    },
  ],
  lastIssuedThreatNumber: 3,
  mitigations: [],
  assumptions: [],
};

/**
 * The model the canvas specs draw: two elements inside a trust boundary, a
 * note beside them, a flow between them, a flow ending at a position that
 * belongs to no element, and threats spread so a name has one of each kind to
 * account for, a single assessed threat on an element and a pair of undecided
 * ones on a flow. The boundary and the note are drawn and are no end of a
 * flow, which is what the connecting controls read.
 */
export const canvasModel: Model = parsedFixture(document);
