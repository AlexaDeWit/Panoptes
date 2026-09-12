import { saerskrivenYamlCodec } from '@saerskriven/formats';
import { parseModel, type Model } from '@saerskriven/model';
import { Either } from 'effect';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { editableModel } from './edit.fixtures.js';
import { openWorkspace, type ModelWorkspace } from './workspace.js';

/** The checkout, which is the root the read tools are exercised against. */
export const repositoryRoot = realpathSync(
  join(import.meta.dirname, '../../../..'),
);

/** The Écluse fixture, in the Threat Dragon format the file is committed in. */
export const ecluseFile = 'test-data/ecluse.json';

/** A YAML text no registered codec claims. */
export const unclaimedFile = 'unclaimed.yaml';

/**
 * A Saerskriven YAML file the native codec claims and refuses: the format
 * version names it, and the threat under it carries a severity no model
 * accepts, so the refusal is path-precise rather than a declining.
 */
export const invalidFile = 'invalid.yaml';

const invalidYaml = `formatVersion: 1
metadata:
  title: Broken
  owner: Owner
  description: ''
  contributors: []
assumptions: []
mitigations: []
diagrams: []
threats:
  - id: threat-1
    number: 1
    title: Spoofed caller
    category: { methodology: STRIDE, category: spoofing }
    severity: catastrophic
    status: open
    description: ''
    mitigation: ''
    elements: []
lastIssuedThreatNumber: 1
`;

/**
 * A workspace over the checkout with the Écluse fixture as its default
 * model, which is what a read tool called with no `file` argument reads.
 */
export function ecluseWorkspace(): ModelWorkspace {
  return Either.getOrThrow(
    openWorkspace({ root: repositoryRoot, file: ecluseFile }),
  );
}

/** Saerskriven's own threat model, in the native format. */
export const saerskrivenFile = 'threat-modelling/saerskriven.yaml';

/** A workspace over the checkout with Saerskriven's own model as its default. */
export function saerskrivenWorkspace(): ModelWorkspace {
  return Either.getOrThrow(
    openWorkspace({ root: repositoryRoot, file: saerskrivenFile }),
  );
}

/** Saerskriven's own model as text, for a fixture that rewrites part of it. */
export function saerskrivenYaml(): string {
  return readFileSync(join(repositoryRoot, saerskrivenFile), 'utf8');
}

/** A workspace over the checkout carrying no default model. */
export function rootWorkspace(): ModelWorkspace {
  return Either.getOrThrow(openWorkspace({ root: repositoryRoot }));
}

/**
 * A disposable root holding the two files a read has to refuse: one no codec
 * claims, and one the native codec claims and refuses.
 */
export function unreadableTree(): ModelWorkspace {
  const root = mkdtempSync(join(tmpdir(), 'saerskriven-mcp-read-'));
  writeFileSync(join(root, unclaimedFile), 'hello: world\n');
  writeFileSync(join(root, invalidFile), invalidYaml);
  return Either.getOrThrow(openWorkspace({ root }));
}

/**
 * A disposable root holding a copy of the Écluse fixture as its default
 * model, for a tool that reads a model and writes a projection beside it.
 */
export function drawableTree(): ModelWorkspace {
  const root = mkdtempSync(join(tmpdir(), 'saerskriven-mcp-out-'));
  copyFileSync(join(repositoryRoot, ecluseFile), join(root, 'ecluse.json'));
  return Either.getOrThrow(openWorkspace({ root, file: 'ecluse.json' }));
}

/** What a tool refused, as the lines it refused with. */
export function refusalOf<Answer>(
  outcome: Either.Either<Answer, readonly string[]>,
): readonly string[] {
  return Either.isLeft(outcome) ? outcome.left : ['the call was not refused'];
}

/** What a tool answered, or a throw naming the refusal it answered with. */
export function answerOf<Answer>(
  outcome: Either.Either<Answer, readonly string[]>,
): Answer {
  if (Either.isLeft(outcome)) {
    throw new Error(outcome.left.join('\n'));
  }
  return outcome.right;
}

const everyRecordModel: Model = parsed({
  ...editableModel,
  threats: [
    ...editableModel.threats,
    {
      id: 'threat-house-rule',
      number: editableModel.lastIssuedThreatNumber + 1,
      title: 'Unwritten house rule',
      category: {
        methodology: 'custom',
        methodologyName: 'House',
        category: 'process gap',
      },
      severity: 'undecided',
      status: 'accepted-risk',
      description: '',
      mitigation: '',
      elements: [],
    },
  ],
  lastIssuedThreatNumber: editableModel.lastIssuedThreatNumber + 1,
});

/**
 * A disposable root whose default model holds every record kind: the editable
 * fixture, which already carries a canvas note, an out-of-scope store, a flow
 * free at one end, both boundary shapes, a mitigation and an assumption, with
 * one threat added under a methodology of its own carrying no prose. The
 * committed Écluse fixture holds none of the last four, so the branches that
 * render them need this.
 */
export function everyRecordTree(): ModelWorkspace {
  return treeHolding(saerskrivenYamlCodec.write(everyRecordModel).output);
}

/**
 * A disposable root holding a model of more threats than a concise listing
 * carries. Every committed fixture holds fewer records than the limit, so
 * nothing else reaches the line a cut listing ends with.
 */
export function crowdedTree(): ModelWorkspace {
  const crowded = parsed({
    ...editableModel,
    mitigations: [],
    assumptions: [],
    threats: Array.from({ length: crowdedThreats }, (unused, index) => ({
      ...everyRecordModel.threats[0],
      id: `threat-${String(index + 1)}`,
      number: index + 1,
      title: `Crowded threat ${String(index + 1)}`,
    })),
    lastIssuedThreatNumber: crowdedThreats,
  });
  return treeHolding(saerskrivenYamlCodec.write(crowded).output);
}

/** How many threats {@link crowdedTree} holds, past every search limit. */
export const crowdedThreats = 60;

/**
 * A disposable root whose default model holds a flow ending on another flow.
 * The model permits an endpoint on any element and the canvas draws a flow as
 * no box, so the layout reports the endpoint and leaves that flow undrawn.
 */
export function unplacedTree(): ModelWorkspace {
  return treeHolding(unplacedFlowYaml);
}

const unplacedFlowYaml = `formatVersion: 1
metadata:
  title: Unplaced
  owner: Owner
  description: ''
  contributors: []
assumptions: []
mitigations: []
diagrams:
  - id: only
    title: Only
    elements:
      - kind: process
        id: element-1
        name: element-1
        description: ''
        outOfScope: false
        reasonOutOfScope: ''
        position: { x: 0, y: 0 }
        size: { width: 10, height: 10 }
      - kind: flow
        id: flow-1
        name: flow-1
        description: ''
        outOfScope: false
        reasonOutOfScope: ''
        source: { kind: attached, element: element-1 }
        target: { kind: free, position: { x: 80, y: 0 } }
        waypoints: []
      - kind: flow
        id: flow-2
        name: flow-2
        description: ''
        outOfScope: false
        reasonOutOfScope: ''
        source: { kind: attached, element: element-1 }
        target: { kind: attached, element: flow-1 }
        waypoints: []
threats: []
lastIssuedThreatNumber: 0
`;

/** A disposable root whose default model is the given text, as `model.yaml`. */
export function treeHolding(yaml: string): ModelWorkspace {
  const root = mkdtempSync(join(tmpdir(), 'saerskriven-mcp-model-'));
  writeFileSync(join(root, 'model.yaml'), yaml);
  return Either.getOrThrow(openWorkspace({ root, file: 'model.yaml' }));
}

function parsed(input: unknown): Model {
  return Either.getOrThrowWith(
    parseModel(input),
    () => new Error('A read-tool fixture does not parse.'),
  );
}
