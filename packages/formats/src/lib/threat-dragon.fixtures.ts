import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
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
 * because `packages/model` transcribes the same file and neither package
 * owns it. That transcription is not compared against directly: it is
 * internal to `packages/model` rather than on its entry point, so this
 * package pins the same counts and vocabularies instead.
 */
export const ecluseText: string = readFileSync(
  join(import.meta.dirname, '../../../../test-data/ecluse.json'),
  'utf8',
);

const vendored = join(
  import.meta.dirname,
  '../../../../test-data/threat-dragon',
);

/**
 * Every Threat Dragon file the repository vendors, named by its path under
 * `test-data`. The twelve models Threat Dragon ships in its own repository,
 * described in `test-data/README.md`, plus the Écluse model, read from the
 * directory rather than from a list, so a file added there is gated without
 * anything else changing.
 */
export const corpusTexts: readonly { name: string; text: string }[] = [
  { name: 'ecluse.json', text: ecluseText },
  ...readdirSync(vendored, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => ({
      name: `threat-dragon/${basename(entry.parentPath)}/${entry.name}`,
      text: readFileSync(join(entry.parentPath, entry.name), 'utf8'),
    })),
];

/**
 * A Threat Dragon document carrying what the Écluse file has no example of:
 * a text block named in `data`, another named only in `attrs`, and a third
 * named nowhere, a threat whose status, severity and category are each from
 * a vocabulary this codec does not know,
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

/**
 * A Threat Dragon document holding what Threat Dragon writes and the
 * internal model has no home for: a text block, a threat with no number, a
 * severity outside the five the editor offers, a category label in the
 * author's own locale, and an EOP threat whose type is null and whose
 * identity is a playing card. Stamped `2.0`, the two-part version Threat
 * Dragon's own models carry. The wire schema reads all of it, and how any
 * of it reaches the model is not settled.
 */
export const unmodelledFixture: ThreatDragonDocument = {
  version: '2.0',
  summary: { title: 'Beyond the model' },
  detail: {
    diagrams: [
      {
        id: 0,
        title: 'Zahlungen',
        diagramType: 'STRIDE',
        version: '2.0',
        cells: [
          {
            id: 'text-1',
            shape: 'td-text-block',
            position: { x: 0, y: 0 },
            size: { width: 200, height: 100 },
            visible: true,
            attrs: { text: { text: 'Arbitrary Text' } },
            data: {
              type: 'tm.Text',
              name: 'Arbitrary Text',
              hasOpenThreats: false,
            },
          },
          {
            id: 'text-2',
            shape: 'td-text-block',
            position: { x: 0, y: 120 },
            size: { width: 200, height: 40 },
            attrs: { text: { text: 'Drawn before the note carried a name' } },
            data: { type: 'tm.Text' },
          },
          {
            id: 'text-3',
            shape: 'td-text-block',
            position: { x: 0, y: 180 },
            size: { width: 200, height: 40 },
            data: { type: 'tm.Text' },
          },
          {
            id: 'process-1',
            shape: 'process',
            position: { x: 0, y: 200 },
            size: { width: 100, height: 100 },
            data: {
              type: 'tm.Process',
              name: 'Zahlungsdienst',
              threats: [
                {
                  id: 'threat-translated',
                  title: 'Manipulation der Anfrage',
                  modelType: 'STRIDE',
                  type: 'Manipulation',
                  status: 'Accepted',
                  severity: 'TBA',
                  description: '',
                  mitigation: '',
                },
                {
                  id: 'threat-unplaceable',
                  title: 'Recorded under a vocabulary of its own',
                  modelType: 'STRIDE',
                  type: 'F\u00e4lschung',
                  status: 'Deferred',
                  severity: 'Catastrophic',
                  description: '',
                  mitigation: '',
                },
                {
                  id: 'threat-card',
                  number: 4,
                  title: 'The attacker reads the session token',
                  modelType: 'EOP',
                  type: null,
                  eopGameId: 'cornucopia',
                  cardSuit: 'Data Validation & Encoding',
                  cardNumber: '3',
                  status: 'Open',
                  severity: 'TBD',
                  description: '',
                  mitigation: '',
                  new: true,
                  score: '',
                },
              ],
            },
          },
        ],
      },
    ],
  },
};
