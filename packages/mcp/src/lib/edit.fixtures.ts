import { saerskrivenYamlCodec } from '@saerskriven/formats';
import { parseModel, type Model } from '@saerskriven/model';
import { validModelFixture } from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import {
  copyFileSync,
  mkdtempSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { z } from 'zod';
import type { modelEditSchema } from './edits.js';
import { unclaimedYaml } from './workspace.fixtures.js';

/** One edit as a client sends it, before the schema fills its defaults in. */
export type EditInput = z.input<typeof modelEditSchema>;

/** The native model a tree holds, named by the spec that edits it. */
export const modelFile = 'model.yaml';

/** The Threat Dragon model a tree holds: the Écluse fixture, copied. */
export const dragonFile = 'dragon.json';

/** A YAML text no codec claims, for the failed parse a write has to survive. */
export const unclaimedFile = 'unclaimed.yaml';

/** The OTM example a tree holds, for the conversion tools. */
export const otmFile = 'source-otm.json';

/** The TM-BOM example a tree holds, for the conversion tools. */
export const tmbomFile = 'source-tmbom.json';

const repositoryRoot = join(import.meta.dirname, '../../../..');

const draft = structuredClone(validModelFixture);

draft.diagrams[0].elements.push({
  kind: 'text',
  id: 'element-note',
  name: 'Reviewer note',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x: 40, y: 420 },
  size: { width: 200, height: 80 },
  text: 'Checked against the deployment diagram.',
});

draft.diagrams.push({
  id: 'diagram-empty',
  title: 'Nothing drawn yet',
  elements: [],
});

/**
 * The model the edit specs work over: the model package's own fixture with a
 * canvas note and an empty diagram beside it, which are what the note and
 * diagram edits need and what no other fixture holds.
 */
export const editableModel: Model = Either.getOrThrowWith(
  parseModel(draft),
  () => new Error('The editable fixture does not parse.'),
);

/** {@link editableModel} as the native YAML a tree writes. */
export const editableYaml = saerskrivenYamlCodec.write(editableModel).output;

/** A root holding the files the write tools read, one temporary tree per call. */
export type EditableTree = {
  readonly root: string;
  readonly copy: (name: string) => string;
};

/**
 * A disposable root with the native model, the Threat Dragon fixture, a text
 * no codec claims, and the OTM example. Every spec here writes, so each takes
 * its own tree rather than sharing one. `copy` puts another copy of the
 * native model under a name of its own and answers with that name, which is
 * how one tree serves a run of edits that each need an untouched file.
 */
export function editableTree(): EditableTree {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), 'saerskriven-mcp-edit-')),
  );
  writeFileSync(join(root, modelFile), editableYaml);
  writeFileSync(join(root, unclaimedFile), unclaimedYaml);
  copyFileSync(
    join(repositoryRoot, 'test-data/ecluse.json'),
    join(root, dragonFile),
  );
  copyFileSync(
    join(repositoryRoot, 'test-data/otm/example.json'),
    join(root, otmFile),
  );
  copyFileSync(
    join(repositoryRoot, 'test-data/tmbom/example.json'),
    join(root, tmbomFile),
  );
  return {
    root,
    copy: (name) => {
      copyFileSync(join(root, modelFile), join(root, name));
      return name;
    },
  };
}

/**
 * One batch per `op` the edit schema declares, each against {@link
 * editableModel} and each changing the model, so a spec can call every
 * variant and hold the write to having produced a different file. The `op` a
 * batch is for is named beside it: a variant taking several edits, as adding
 * elements of different kinds does, is still one entry.
 */
export const editVariants: readonly {
  readonly op: EditInput['op'];
  readonly edits: readonly EditInput[];
}[] = [
  {
    op: 'add_element',
    edits: [
      {
        op: 'add_element',
        diagram: 'diagram-main',
        element: {
          kind: 'actor',
          id: 'element-auditor',
          name: 'Auditor',
          placement: 'auto',
        },
      },
      {
        op: 'add_element',
        diagram: 'diagram-main',
        element: {
          kind: 'text',
          id: 'element-second-note',
          name: 'Second note',
          text: 'Raised at the review.',
          placement: {
            position: { x: 320, y: 420 },
            size: { width: 180, height: 60 },
          },
        },
      },
      {
        op: 'add_element',
        diagram: 'diagram-main',
        element: {
          kind: 'trust-boundary',
          id: 'element-audit-zone',
          name: 'Audit zone',
          shape: {
            kind: 'curve',
            waypoints: [
              { x: 0, y: 500 },
              { x: 400, y: 520 },
            ],
          },
        },
      },
      {
        op: 'add_element',
        diagram: 'diagram-main',
        element: {
          kind: 'flow',
          id: 'element-audit-flow',
          name: 'Audit record',
          source: { kind: 'attached', element: 'element-api' },
          target: { kind: 'free', position: { x: 520, y: 460 } },
        },
      },
    ],
  },
  {
    op: 'set_element_properties',
    edits: [
      {
        op: 'set_element_properties',
        element: 'element-db',
        properties: {
          kind: 'store',
          isEncrypted: true,
          storesCredentials: false,
        },
      },
    ],
  },
  {
    op: 'remove_element',
    edits: [{ op: 'remove_element', element: 'element-note' }],
  },
  {
    op: 'move_element',
    edits: [
      { op: 'move_element', element: 'element-api', offset: { x: 40, y: -20 } },
    ],
  },
  {
    op: 'resize_element',
    edits: [
      {
        op: 'resize_element',
        element: 'element-api',
        size: { width: 220, height: 120 },
      },
    ],
  },
  {
    op: 'rename_element',
    edits: [
      { op: 'rename_element', element: 'element-db', name: 'Order store' },
    ],
  },
  {
    op: 'edit_note',
    edits: [
      {
        op: 'edit_note',
        element: 'element-note',
        text: 'Checked again after the review.',
      },
    ],
  },
  {
    op: 'set_flow_waypoints',
    edits: [
      {
        op: 'set_flow_waypoints',
        element: 'element-order-flow',
        waypoints: [
          { x: 220, y: 150 },
          { x: 260, y: 170 },
        ],
      },
    ],
  },
  {
    op: 'set_flow_direction',
    edits: [
      {
        op: 'set_flow_direction',
        element: 'element-order-flow',
        bidirectional: true,
      },
    ],
  },
  {
    op: 'reconnect_flow',
    edits: [
      {
        op: 'reconnect_flow',
        element: 'element-order-flow',
        side: 'target',
        endpoint: 'element-api',
        anchor: 'left',
      },
    ],
  },
  {
    op: 'add_threat',
    edits: [
      {
        op: 'add_threat',
        threat: {
          id: 'threat-replayed-order',
          title: 'Replayed order',
          category: { methodology: 'STRIDE', category: 'spoofing' },
          severity: 'medium',
          status: 'open',
          description: 'A captured order is submitted a second time.',
          mitigation: '',
          elements: ['element-api'],
        },
      },
    ],
  },
  {
    op: 'replace_threat',
    edits: [
      {
        op: 'replace_threat',
        threat: {
          id: 'threat-tamper-order',
          title: 'Order tampering between the customer and the API',
          category: { methodology: 'STRIDE', category: 'tampering' },
          severity: 'critical',
          status: 'mitigated',
          description: 'An order can be altered in transit.',
          mitigation: 'TLS on every hop.',
          elements: ['element-api'],
        },
      },
    ],
  },
  {
    op: 'remove_threat',
    edits: [{ op: 'remove_threat', threat: 'threat-tamper-order' }],
  },
  {
    op: 'attach_threat',
    edits: [
      {
        op: 'attach_threat',
        threat: 'threat-tamper-order',
        element: 'element-db',
      },
    ],
  },
  {
    op: 'detach_threat',
    edits: [
      {
        op: 'detach_threat',
        threat: 'threat-tamper-order',
        element: 'element-api',
      },
    ],
  },
  {
    op: 'set_threat_status',
    edits: [
      {
        op: 'set_threat_status',
        threat: 'threat-tamper-order',
        status: 'mitigated',
      },
    ],
  },
  {
    op: 'set_threat_severity',
    edits: [
      {
        op: 'set_threat_severity',
        threat: 'threat-tamper-order',
        severity: 'critical',
      },
    ],
  },
  {
    op: 'set_threat_category',
    edits: [
      {
        op: 'set_threat_category',
        threat: 'threat-tamper-order',
        category: { methodology: 'LINDDUN', category: 'linking' },
      },
    ],
  },
  {
    op: 'add_mitigation',
    edits: [
      {
        op: 'add_mitigation',
        mitigation: {
          id: 'mitigation-audit-log',
          title: 'Audit log',
          prose: 'Record every write with the caller.',
          status: 'proposed',
          threats: ['threat-tamper-order'],
        },
      },
    ],
  },
  {
    op: 'replace_mitigation',
    edits: [
      {
        op: 'replace_mitigation',
        mitigation: {
          id: 'mitigation-tls',
          title: 'TLS on the order flow',
          prose: 'Terminate TLS at the perimeter and pin the certificate.',
          status: 'implemented',
          threats: ['threat-tamper-order'],
        },
      },
    ],
  },
  {
    op: 'remove_mitigation',
    edits: [{ op: 'remove_mitigation', mitigation: 'mitigation-tls' }],
  },
  {
    op: 'add_assumption',
    edits: [
      {
        op: 'add_assumption',
        assumption: {
          id: 'assumption-backups',
          prose: 'Backups are encrypted with the same key policy.',
          status: 'valid',
          elements: ['element-db'],
          threats: [],
        },
      },
    ],
  },
  {
    op: 'replace_assumption',
    edits: [
      {
        op: 'replace_assumption',
        assumption: {
          id: 'assumption-managed-db',
          prose: 'The order database encrypts its disks.',
          status: 'invalidated',
          elements: ['element-db'],
          threats: ['threat-tamper-order'],
        },
      },
    ],
  },
  {
    op: 'remove_assumption',
    edits: [{ op: 'remove_assumption', assumption: 'assumption-managed-db' }],
  },
  {
    op: 'add_diagram',
    edits: [
      { op: 'add_diagram', diagram: 'diagram-payments', title: 'Payments' },
    ],
  },
  {
    op: 'rename_diagram',
    edits: [
      { op: 'rename_diagram', diagram: 'diagram-main', title: 'Main flows' },
    ],
  },
  {
    op: 'remove_diagram',
    edits: [{ op: 'remove_diagram', diagram: 'diagram-empty' }],
  },
  {
    op: 'set_model_metadata',
    edits: [
      {
        op: 'set_model_metadata',
        owner: 'Jonas Lindqvist',
        contributors: ['Alexandra de Wit', 'Jonas Lindqvist'],
      },
    ],
  },
];
