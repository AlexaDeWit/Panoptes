import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const heading = `formatVersion: 1
metadata:
  title: Small
  owner: Owner
  description: ''
  contributors: []
assumptions: []
mitigations: []
`;

const oneThreat = `threats:
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

const processElement = (id: string, x: number): string => `      - kind: process
        id: ${id}
        name: ${id}
        description: ''
        outOfScope: false
        reasonOutOfScope: ''
        position: { x: ${String(x)}, y: 0 }
        size: { width: 10, height: 10 }
`;

const flow = (id: string, target: string): string => `      - kind: flow
        id: ${id}
        name: ${id}
        description: ''
        outOfScope: false
        reasonOutOfScope: ''
        source: { kind: attached, element: element-1 }
        target: { kind: attached, element: ${target} }
        waypoints: []
`;

const referencing = (element: string): string => `${heading}diagrams:
  - id: only
    title: Only
    elements:
${processElement('element-1', 0)}threats:
  - id: threat-1
    number: 1
    title: Spoofed caller
    category: { methodology: STRIDE, category: spoofing }
    severity: high
    status: open
    description: ''
    mitigation: ''
    elements: [${element}]
lastIssuedThreatNumber: 1
`;

/**
 * A native file whose one threat names an element no diagram holds. The
 * document is valid and the model it maps to is not, which is the failure
 * that carries a path into the model rather than into the file.
 */
export const danglingReferenceYaml = referencing('element-2');

/**
 * A native file whose one threat names an element id built out of ANSI
 * escapes, which the model refuses and then quotes back in the sentence
 * saying the reference resolves to nothing.
 */
export const ansiElementIdYaml = referencing('"\\e[31mBOOM\\e[0m"');

/**
 * A native file whose one threat names an element id spelling those same
 * escapes out of literal characters. The model accepts the text, and what
 * a user reads has to tell it apart from the file above.
 */
export const literalEscapeIdYaml = referencing('"\\\\e[31mBOOM\\\\e[0m"');

/**
 * A native file carrying a key the wire schema does not declare, which a
 * read drops and reports as a divergence rather than passing over.
 */
export const undeclaredKeyYaml = `${heading}nonsense: true
diagrams: []
${oneThreat}`;

/** A native file whose title is a number, which the wire schema refuses. */
export const brokenDocumentYaml = `${heading.replace(
  'title: Small',
  'title: 42',
)}diagrams: []
${oneThreat}`;

/** A native file holding no diagram, so there is nothing to draw. */
export const noDiagramYaml = `${heading}diagrams: []
${oneThreat}`;

/**
 * A native file whose second flow ends on the first flow. The model permits
 * an endpoint on any element, the canvas draws a flow as no box, so the
 * layout reports the endpoint and leaves that flow out of the drawing.
 */
export const unplacedFlowYaml = `${heading}diagrams:
  - id: only
    title: Only
    elements:
${processElement('element-1', 0)}${processElement('element-2', 100)}${flow(
  'flow-1',
  'element-2',
)}${flow('flow-2', 'flow-1')}${oneThreat}`;

/** A YAML text no registered codec claims. */
export const unclaimedYaml = 'hello: world\n';

/** One fixture on disk, at the path it was written to. */
export function fixtureFile(
  directory: string,
  name: string,
  text: string,
): string {
  const path = join(directory, name);
  writeFileSync(path, text);
  return path;
}
