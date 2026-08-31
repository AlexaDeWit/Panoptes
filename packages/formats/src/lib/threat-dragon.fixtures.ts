import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ThreatDragonDocument,
  ThreatDragonThreat,
} from './threat-dragon-wire.js';

const linkability: ThreatDragonThreat = {
  id: 'threat-linkability',
  number: 3,
  title: 'Two records join on the operator id',
  modelType: 'LINDDUN',
  type: 'Linkability',
  status: 'NotApplicable',
  severity: 'TBD',
  description: 'The same identifier appears on both sides.',
  mitigation: 'Rotate the identifier per audience.',
};

const ethics: ThreatDragonThreat = {
  id: 'threat-ethics',
  number: 4,
  title: 'The ranking is not explained to the person it ranks',
  modelType: 'PLOT4ai',
  type: 'Ethics & Human Rights',
  status: 'Open',
  severity: 'Low',
  description: 'No recourse is offered.',
  mitigation: '',
};

/**
 * The Écluse threat model as Threat Dragon 2.6.2 wrote it, read from the
 * file vendored at `test-data/ecluse.json`. It lives at the repository root
 * because `packages/model` transcribes the same file and the layer matrix
 * forbids a package dependency between the two readers.
 */
export const ecluseText: string = readFileSync(
  join(import.meta.dirname, '../../../../test-data/ecluse.json'),
  'utf8',
);

/**
 * A Threat Dragon document carrying what the Écluse file has no example of:
 * boundary curves under both the correct shape name and the misspelling
 * Threat Dragon registers for compatibility, a boundary named in `data` and
 * another named nowhere, one threat nested under two cells, a methodology
 * that reaches the model as a custom category, a contributor with no name,
 * a cell whose `data` holds nothing but its type, and a diagram with no
 * cells at all. Stamped `2.0.0`, so a read of it is also evidence that the
 * version pin accepts the major rather than one release.
 */
export const complementFixture: ThreatDragonDocument = {
  version: '2.0.0',
  summary: { title: 'Complement', id: 'model-1' },
  detail: {
    contributors: [{ name: 'Alexandra de Wit' }, {}],
    diagrams: [
      {
        id: 4,
        title: 'Curves and defaults',
        diagramType: 'LINDDUN',
        version: '2.0.0',
        cells: [
          {
            id: 'boundary-curve',
            shape: 'trust-boundary-curve',
            data: {
              type: 'tm.Boundary',
              name: 'Operator zone',
              description: 'Drawn freehand.',
            },
            attrs: { label: { text: 'Operator zone, as drawn' } },
            source: { x: 0, y: 0 },
            target: { x: 40, y: 40 },
            vertices: [{ x: 20, y: 10 }],
          },
          {
            id: 'boundary-typo',
            shape: 'trust-broundary-curve',
            data: { type: 'tm.Boundary' },
            source: { x: 0, y: 60 },
            target: { x: 40, y: 60 },
          },
          {
            id: 'actor-1',
            shape: 'actor',
            position: { x: 0, y: 0 },
            size: { width: 100, height: 60 },
            data: {
              type: 'tm.Actor',
              name: 'Operator',
              threats: [linkability],
            },
          },
          {
            id: 'store-1',
            shape: 'store',
            position: { x: 200, y: 0 },
            size: { width: 100, height: 60 },
            data: { type: 'tm.Store', threats: [linkability, ethics] },
          },
          {
            id: 'flow-1',
            shape: 'flow',
            data: { type: 'tm.Flow', name: 'reads' },
            source: { cell: 'actor-1' },
            target: { cell: 'store-1' },
          },
        ],
      },
      { id: 5, title: 'Nothing drawn yet', diagramType: 'STRIDE' },
    ],
  },
};

/**
 * A Threat Dragon document holding nothing the format does not require, so
 * a read of it is a read of the defaults. Stamped with a 2.x release Threat
 * Dragon never shipped, which the version pin accepts all the same.
 */
export const minimalFixture: ThreatDragonDocument = {
  version: '2.9.13',
  summary: { title: 'Nothing but a title' },
  detail: { diagrams: [] },
};
