import {
  assumptionSchema,
  diagramSchema,
  mitigationSchema,
  modelMetadataSchema,
  threatSchema,
} from '@panoptes/model';
import type {
  ThreatDragonDocument,
  ThreatDragonThreat,
} from '@panoptes/wire-threat-dragon';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

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
 * Every Threat Dragon threat model the repository vendors, named by its
 * path under `test-data`. The twelve models Threat Dragon ships in its own
 * repository, described in `test-data/README.md`, plus the Écluse model,
 * read from the directories rather than from a list, so a model added
 * beside them is gated without anything else changing. The vendored locale
 * tables live under the same root and are not threat models, so they are
 * not read here.
 */
export const corpusTexts: readonly { name: string; text: string }[] = [
  { name: 'ecluse.json', text: ecluseText },
  ...['demo', 'models'].flatMap((folder) =>
    readdirSync(join(vendored, folder))
      .filter((name) => name.endsWith('.json'))
      .map((name) => ({
        name: `threat-dragon/${folder}/${name}`,
        text: readFileSync(join(vendored, folder, name), 'utf8'),
      })),
  ),
];

/**
 * The JSON Schema Threat Dragon validates a v2 model against before it
 * opens one, vendored under `test-data/threat-dragon/schema`. A write is
 * measured against it with the validator Threat Dragon itself runs, which
 * gates the shape of the document alone: the schema declares a cell's
 * threats beside `data` rather than under it, so nothing it says reaches
 * the threats this codec writes.
 */
export const threatDragonJsonSchema: Readonly<Record<string, unknown>> = z
  .record(z.string(), z.unknown())
  .parse(
    JSON.parse(
      readFileSync(
        join(vendored, 'schema/threat-dragon-v2.schema.json'),
        'utf8',
      ),
    ),
  );

/**
 * The Écluse model in the internal form, as `packages/model` writes it out
 * of its own fixture. Both packages read this one file: the model package
 * regenerates it from `ecluseFixture` and fails where the two differ, and
 * the read here is compared against it whole, so a drift in an element
 * description or an endpoint no longer passes both suites unnoticed.
 */
export const ecluseModel: unknown = JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../../../../test-data/ecluse.model.json'),
    'utf8',
  ),
);

/**
 * Threat Dragon's category labels in every language it ships, keyed by
 * language and then by methodology, as vendored under
 * `test-data/threat-dragon/i18n`. The tables in `threat-dragon-locales.ts`
 * are derived from exactly this, so the derivation is what a test checks
 * rather than the result.
 */
export const localeCategories: Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>
> = Object.fromEntries(
  readdirSync(join(vendored, 'i18n'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => [
      name.replace(/\.json$/, ''),
      categoriesIn(join(vendored, 'i18n', name)),
    ]),
);

function categoriesIn(path: string): Record<string, Record<string, string>> {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return z.record(z.string(), z.record(z.string(), z.string())).parse(parsed);
}

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

/**
 * A whole model as `parseModel` takes it, typed from the schemas the model
 * package exports rather than from the model schema itself, which stays
 * internal to that package. A fixture literal carries this annotation where
 * it is written: the shared `parsedFixture` takes `unknown`, so nothing else
 * checks the literal before the parse.
 */
export type ModelInput = {
  metadata: z.input<typeof modelMetadataSchema>;
  diagrams: z.input<typeof diagramSchema>[];
  threats: z.input<typeof threatSchema>[];
  lastIssuedThreatNumber: number;
  mitigations: z.input<typeof mitigationSchema>[];
  assumptions: z.input<typeof assumptionSchema>[];
};

/**
 * A model holding what Threat Dragon has no place for, so that a write of
 * it reports every reason a write can report. Threats attached to two
 * elements at once, to a trust boundary, and to nothing at all; a PLOT4ai
 * category from the eight the model enumerates rather than the eight Threat
 * Dragon ships; a note carrying a name beside its text; an out-of-scope
 * trust boundary; a diagram named rather than numbered; and the mitigation
 * and assumption records the format keeps none of. Every extent is 10 or
 * more and every coordinate is whole, which is what Threat Dragon's own
 * JSON Schema demands of a diagram it will open.
 */
export const richerThanFormatFixture: ModelInput = {
  metadata: {
    title: 'Ledger',
    owner: 'Alexandra de Wit',
    description: 'Richer than the format it is written to.',
    contributors: ['Alexandra de Wit', 'Jonas Lindqvist'],
  },
  diagrams: [
    {
      id: '0',
      title: 'Ledger flows',
      elements: [
        {
          kind: 'actor',
          id: 'element-clerk',
          name: 'Clerk',
          description: 'Posts entries by hand.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 40, y: 40 },
          size: { width: 160, height: 80 },
        },
        {
          kind: 'process',
          id: 'element-ledger',
          name: 'Ledger service',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 320, y: 40 },
          size: { width: 160, height: 80 },
        },
        {
          kind: 'store',
          id: 'element-vault',
          name: 'Entry vault',
          description: '',
          outOfScope: true,
          reasonOutOfScope: 'Operated by the records department.',
          position: { x: 600, y: 40 },
          size: { width: 160, height: 80 },
        },
        {
          kind: 'flow',
          id: 'element-post',
          name: 'Post entry',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'attached', element: 'element-clerk' },
          target: { kind: 'free', position: { x: 300, y: 200 } },
          waypoints: [{ x: 220, y: 120 }],
        },
        {
          kind: 'trust-boundary',
          id: 'element-zone',
          name: 'Records zone',
          description: '',
          outOfScope: true,
          reasonOutOfScope: 'Drawn for context alone.',
          shape: {
            kind: 'box',
            position: { x: 560, y: 10 },
            size: { width: 240, height: 140 },
          },
        },
        {
          kind: 'text',
          id: 'element-note',
          name: 'Review note',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 40, y: 240 },
          size: { width: 200, height: 40 },
          text: 'Reviewed in August.',
        },
      ],
    },
    {
      id: 'perimeter-review',
      title: 'Perimeter review',
      elements: [
        {
          kind: 'trust-boundary',
          id: 'element-perimeter',
          name: 'Perimeter',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          shape: {
            kind: 'curve',
            waypoints: [
              { x: 0, y: 0 },
              { x: 40, y: 20 },
              { x: 80, y: 0 },
            ],
          },
        },
      ],
    },
  ],
  threats: [
    {
      id: 'threat-split',
      number: 1,
      title: 'An entry is altered between the service and the vault',
      category: { methodology: 'STRIDE', category: 'tampering' },
      severity: 'high',
      status: 'open',
      description: 'Nothing signs an entry on its way to storage.',
      mitigation: '',
      elements: ['element-ledger', 'element-vault'],
    },
    {
      id: 'threat-privacy',
      number: 2,
      title: 'The clerk terminal is not hardened',
      category: { methodology: 'PLOT4ai', category: 'cybersecurity' },
      severity: 'medium',
      status: 'mitigated',
      description: 'The terminal runs unattended.',
      mitigation: 'Lock the session after a minute.',
      elements: ['element-clerk'],
    },
    {
      id: 'threat-zone',
      number: 3,
      title: 'The records zone outlives its purpose',
      category: { methodology: 'CIA-DIE', category: 'ephemeral' },
      severity: 'low',
      status: 'accepted-risk',
      description: 'Nobody retires the zone.',
      mitigation: '',
      elements: ['element-zone'],
    },
    {
      id: 'threat-unattached',
      number: 5,
      title: 'The model falls behind the system',
      category: {
        methodology: 'custom',
        methodologyName: 'Process',
        category: 'documentation',
      },
      severity: 'undecided',
      status: 'open',
      description: 'The diagrams are not reviewed with a release.',
      mitigation: '',
      elements: [],
    },
  ],
  lastIssuedThreatNumber: 9,
  mitigations: [
    {
      id: 'mitigation-sign-entries',
      title: 'Sign every entry',
      prose: 'The service signs an entry before the vault accepts it.',
      status: 'proposed',
      threats: ['threat-split'],
    },
  ],
  assumptions: [
    {
      id: 'assumption-vault-audited',
      prose: 'The vault is audited every year.',
      status: 'valid',
      elements: ['element-vault'],
      threats: ['threat-split'],
    },
  ],
};

/**
 * A Threat Dragon document the model above can be merged onto: written by a
 * release this codec does not stamp, carrying styling and ports the model
 * never holds, a diagram and a cell and a threat an edit has since removed,
 * and a threat high-water mark below the model's own.
 */
export const richerThanFormatSource: ThreatDragonDocument = {
  version: '2.0.0',
  summary: { title: 'Ledger', id: 4, tags: ['finance'] },
  detail: {
    contributors: [{ name: 'Alexandra de Wit' }],
    reviewer: 'Jonas Lindqvist',
    diagramTop: 8,
    threatTop: 3,
    diagrams: [
      {
        id: 0,
        title: 'Ledger flows',
        diagramType: 'STRIDE',
        thumbnail: './public/content/images/thumbnail.stride.jpg',
        version: '2.0.0',
        cells: [
          {
            id: 'element-clerk',
            shape: 'actor',
            zIndex: 4,
            position: { x: 40, y: 40 },
            size: { width: 160, height: 80 },
            attrs: {
              body: {
                stroke: '#333333',
                strokeWidth: 1.5,
                strokeDasharray: null,
              },
            },
            ports: { items: [{ group: 'top', id: 'port-1' }] },
            data: {
              type: 'tm.Actor',
              name: 'Clerk',
              description: 'Posts entries by hand.',
              hasOpenThreats: true,
              providesAuthentication: true,
              threats: [
                {
                  id: 'threat-gone',
                  number: 3,
                  title: 'A threat an edit has since removed',
                  modelType: 'STRIDE',
                  type: 'Spoofing',
                  status: 'Open',
                  severity: 'High',
                  description: '',
                  mitigation: '',
                },
                {
                  id: 'threat-privacy',
                  number: 2,
                  title: 'The clerk terminal is not hardened',
                  modelType: 'STRIDE',
                  type: 'Tampering',
                  status: 'Mitigated',
                  severity: 'Medium',
                  description: 'The terminal runs unattended.',
                  mitigation: 'Lock the session after a minute.',
                  score: '7',
                },
              ],
            },
          },
          {
            id: 'element-gone',
            shape: 'store',
            zIndex: 5,
            position: { x: 900, y: 40 },
            size: { width: 160, height: 80 },
            data: { type: 'tm.Store', name: 'A store an edit removed' },
          },
        ],
      },
      {
        id: 7,
        title: 'An older sketch',
        diagramType: 'STRIDE',
        thumbnail: './public/content/images/thumbnail.stride.jpg',
        version: '2.0.0',
      },
    ],
  },
};
