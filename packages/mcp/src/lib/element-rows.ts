import { escapedForTerminal } from '@saerskriven/formats';
import {
  acceptedTextSchema,
  boundaryShapeSchema,
  diagramIdSchema,
  elementIdSchema,
  elementKindSchema,
  flowEndpointSchema,
  pointSchema,
  sizeSchema,
  waypointsSchema,
  type Diagram,
  type Element,
  type FlowEndpoint,
} from '@saerskriven/model';
import { z } from 'zod';

/**
 * What every element row names: the id a further call passes, the diagram it
 * is drawn on, its kind, its name, whether it is in scope, and how many
 * threats reference it. Scope is on the row rather than in the detail because
 * a listing that hides it reads an out-of-scope element as an unanalyzed one.
 */
export const elementRowSchema = z.object({
  id: elementIdSchema,
  diagram: diagramIdSchema,
  kind: elementKindSchema,
  name: acceptedTextSchema,
  outOfScope: z.boolean(),
  threats: z.int().nonnegative(),
});

/**
 * An element row with the rest of the record, every added field optional
 * because each belongs to some kinds and not others: a flow carries endpoints
 * and no box, a trust boundary a shape, a note its text.
 */
export const elementDetailSchema = elementRowSchema.extend({
  description: acceptedTextSchema.optional(),
  reasonOutOfScope: acceptedTextSchema.optional(),
  position: pointSchema.optional(),
  size: sizeSchema.optional(),
  source: flowEndpointSchema.optional(),
  target: flowEndpointSchema.optional(),
  waypoints: waypointsSchema.optional(),
  shape: boundaryShapeSchema.optional(),
  text: acceptedTextSchema.optional(),
});

/** One element as a search or a coverage report carries it. */
export type ElementDetail = z.infer<typeof elementDetailSchema>;

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
): ElementDetail {
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
    ...elementRow(placed, threats),
    description: element.description,
    reasonOutOfScope: element.reasonOutOfScope,
    ...geometryOf(element),
  };
}

/**
 * One element as the lines a text result carries: a heading line naming it,
 * and one indented line per field the row carries past the heading.
 */
export function renderElement(row: ElementDetail): readonly string[] {
  return [
    `  ${row.id} (${row.kind}, diagram ${row.diagram}, threats ${String(row.threats)}${row.outOfScope ? ', out of scope' : ''}): ${escapedForTerminal(row.name)}`,
    ...detailLines(row).map((line) => `    ${line}`),
  ];
}

function geometryOf(element: Element): Partial<ElementDetail> {
  if (element.kind === 'flow') {
    return {
      source: element.source,
      target: element.target,
      waypoints: element.waypoints,
    };
  }
  if (element.kind === 'trust-boundary') {
    return { shape: element.shape };
  }
  if (element.kind === 'text') {
    return {
      position: element.position,
      size: element.size,
      text: element.text,
    };
  }
  return { position: element.position, size: element.size };
}

function detailLines(row: ElementDetail): readonly string[] {
  return [
    ...(row.description === undefined || row.description.length === 0
      ? []
      : [`description: ${escapedForTerminal(row.description)}`]),
    ...(row.outOfScope && row.reasonOutOfScope !== undefined
      ? [`reason out of scope: ${escapedForTerminal(row.reasonOutOfScope)}`]
      : []),
    ...(row.text === undefined || row.text.length === 0
      ? []
      : [`text: ${escapedForTerminal(row.text)}`]),
    ...(row.position === undefined || row.size === undefined
      ? []
      : [
          `box: ${String(row.position.x)},${String(row.position.y)} sized ${String(row.size.width)} by ${String(row.size.height)}`,
        ]),
    ...(row.source === undefined
      ? []
      : [`source: ${renderEndpoint(row.source)}`]),
    ...(row.target === undefined
      ? []
      : [`target: ${renderEndpoint(row.target)}`]),
    ...(row.waypoints === undefined || row.waypoints.length === 0
      ? []
      : [`waypoints: ${String(row.waypoints.length)}`]),
    ...(row.shape === undefined ? [] : [`shape: ${row.shape.kind}`]),
  ];
}

function renderEndpoint(endpoint: FlowEndpoint): string {
  return endpoint.kind === 'attached'
    ? `element ${endpoint.element}${endpoint.side === undefined ? '' : ` on its ${endpoint.side}`}`
    : `free at ${String(endpoint.position.x)},${String(endpoint.position.y)}`;
}
