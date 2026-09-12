import { escapedForTerminal } from '@saerskriven/formats';
import {
  acceptedTextSchema,
  diagramIdSchema,
  elementIdSchema,
  elementKindSchema,
  elementSchema,
  type Diagram,
  type Element,
  type FlowEndpoint,
} from '@saerskriven/model';
import { z } from 'zod';

const elementContextSchema = z.object({
  diagram: diagramIdSchema,
  threats: z.int().nonnegative(),
});

/** A concise identity, scope and threat count for an element. */
export const elementRowSchema = elementContextSchema.extend({
  id: elementIdSchema,
  kind: elementKindSchema,
  name: acceptedTextSchema,
  outOfScope: z.boolean(),
});

const [firstElementSchema, ...otherElementSchemas] = elementSchema.options;

/** Detailed reads carry the complete model variant, including future model fields. */
export const elementDetailSchema = z.discriminatedUnion('kind', [
  firstElementSchema.extend(elementContextSchema.shape),
  ...otherElementSchemas.map((variant) =>
    variant.extend(elementContextSchema.shape),
  ),
]);

/** A full element with its diagram and threat count. */
export type ElementDetail = z.infer<typeof elementDetailSchema>;

/** The concise fields used by search summaries and coverage reports. */
export type ElementRow = z.infer<typeof elementRowSchema>;

/** Search returns either a complete element or the concise row. */
export const elementResultSchema = z.union([
  elementDetailSchema,
  elementRowSchema,
]);

/** One element of a diagram, paired with the diagram that owns it. */
export type ElementOnDiagram = {
  readonly element: Element;
  readonly diagram: Diagram;
};

/** Every element of the given diagrams, each paired with its own diagram. */
export function elementsOnDiagrams(
  diagrams: readonly Diagram[],
): readonly ElementOnDiagram[] {
  return diagrams.flatMap((diagram) =>
    diagram.elements.map((element) => ({ element, diagram })),
  );
}

/** The identifying fields of one element, and its threat count. */
export function elementRow(
  { element, diagram }: ElementOnDiagram,
  threats: number,
): ElementRow {
  return {
    id: element.id,
    diagram: diagram.id,
    kind: element.kind,
    name: element.name,
    outOfScope: element.outOfScope,
    threats,
  };
}

/** One element with the rest of its record, the geometry of its kind included. */
export function elementDetail(
  placed: ElementOnDiagram,
  threats: number,
): ElementDetail {
  const { element } = placed;
  return {
    ...element,
    diagram: placed.diagram.id,
    threats,
  };
}

/** Text results retain explicit false, empty text and empty relationship lists. */
export function renderElement(
  row: ElementDetail | ElementRow,
): readonly string[] {
  return [
    escapedForTerminal(
      `  ${row.id} (${row.kind}, diagram ${row.diagram}, threats ${String(row.threats)}${row.outOfScope ? ', out of scope' : ''}): ${row.name}`,
    ),
    ...('description' in row
      ? detailLines(row).map((line) => `    ${escapedForTerminal(line)}`)
      : []),
  ];
}

const formattedFields = new Set<string>([
  ...elementRowSchema.keyof().options,
  'description',
  'reasonOutOfScope',
  'position',
  'size',
  'source',
  'target',
  'waypoints',
  'shape',
  'text',
]);

function detailLines(row: ElementDetail): readonly string[] {
  return [
    ...(row.description.length === 0
      ? []
      : [`description: ${row.description}`]),
    ...(row.outOfScope ? [`reason out of scope: ${row.reasonOutOfScope}`] : []),
    ...(row.kind === 'text' && row.text.length > 0
      ? [`text: ${row.text}`]
      : []),
    ...('position' in row
      ? [
          `box: ${String(row.position.x)},${String(row.position.y)} sized ${String(row.size.width)} by ${String(row.size.height)}`,
        ]
      : []),
    ...(row.kind === 'flow'
      ? [
          `source: ${renderEndpoint(row.source)}`,
          `target: ${renderEndpoint(row.target)}`,
          ...(row.waypoints.length === 0
            ? []
            : [`waypoints: ${String(row.waypoints.length)}`]),
        ]
      : []),
    ...(row.kind === 'trust-boundary' ? [`shape: ${row.shape.kind}`] : []),
    ...Object.entries(row)
      .filter(
        ([key, value]) => !formattedFields.has(key) && value !== undefined,
      )
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`),
  ];
}

function renderEndpoint(endpoint: FlowEndpoint): string {
  return endpoint.kind === 'attached'
    ? `element ${endpoint.element}${endpoint.side === undefined ? '' : ` on its ${endpoint.side}`}`
    : `free at ${String(endpoint.position.x)},${String(endpoint.position.y)}`;
}
