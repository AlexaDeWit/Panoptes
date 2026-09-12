import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** A model of one threat and no diagram, in the native format. */
export const smallYaml = `formatVersion: 1
metadata:
  title: Small
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
    severity: high
    status: open
    description: ''
    mitigation: ''
    elements: []
lastIssuedThreatNumber: 1
`;

/** A YAML text no registered codec claims. */
export const unclaimedYaml = 'hello: world\n';

/**
 * A root holding one model, one text no codec claims, a nested directory
 * with another model, a file the walk ignores, and a symbolic link out to a
 * model beside the root. Two paths outside it are the confinement cases: the
 * link resolves out while spelling a path inside, and `sibling` sits in a
 * directory whose name begins with the root's own, so a containment check
 * comparing text rather than path segments lets it through.
 */
export function workspaceTree(): {
  readonly root: string;
  readonly outside: string;
  readonly sibling: string;
} {
  const base = mkdtempSync(join(tmpdir(), 'saerskriven-mcp-'));
  const root = join(base, 'root');
  mkdirSync(join(root, 'nested'), { recursive: true });
  mkdirSync(join(base, 'root-evil'), { recursive: true });
  writeFileSync(join(root, 'small.yaml'), smallYaml);
  writeFileSync(join(root, 'notes.md'), 'not a model');
  writeFileSync(join(root, 'unclaimed.yaml'), unclaimedYaml);
  writeFileSync(join(root, 'nested', 'deeper.yaml'), smallYaml);
  const outside = join(base, 'outside.yaml');
  writeFileSync(outside, smallYaml);
  symlinkSync(outside, join(root, 'link.yaml'));
  const sibling = join(base, 'root-evil', 'secret.yaml');
  writeFileSync(sibling, smallYaml);
  return { root, outside, sibling };
}

/**
 * A named pipe inside `root`, which `stat` reports as empty and a
 * synchronous read blocks on forever. The caller removes it, since a spec
 * that leaves one behind wedges the next reader of that directory.
 */
export function namedPipeIn(root: string, name: string): string {
  const path = join(root, name);
  execFileSync('mkfifo', [path]);
  return path;
}
