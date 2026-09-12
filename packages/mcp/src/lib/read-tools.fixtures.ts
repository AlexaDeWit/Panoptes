import { Either } from 'effect';
import {
  copyFileSync,
  mkdtempSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
