import type { BoundaryShape, Element, Flow, FlowEndpoint } from './elements.js';
import type { Point, Size } from './geometry.js';
import type { DiagramId, ElementId } from './ids.js';
import type { Diagram } from './model.js';
import type { Model } from './parse.js';

/**
 * Why a graph operation refused to produce a model: the discriminant names
 * the violation and the remaining fields carry the offending id or
 * reference. Operation failures are relational facts about the model;
 * structural validity of an input value is its own schema's contract.
 */
export type OperationFailure =
  | { readonly kind: 'unknown-diagram'; readonly diagramId: DiagramId }
  | { readonly kind: 'unknown-element'; readonly elementId: ElementId }
  | { readonly kind: 'duplicate-element-id'; readonly elementId: ElementId }
  | {
      readonly kind: 'invalid-flow-endpoint';
      readonly side: 'source' | 'target';
      readonly reference: ElementId;
    }
  | { readonly kind: 'not-resizable'; readonly elementId: ElementId };

/**
 * Outcome of a fallible graph operation, in the shape of zod's safeParse
 * result: the new model on success, a structured {@link OperationFailure}
 * otherwise. The input model is never mutated either way.
 */
export type OperationResult =
  | { readonly success: true; readonly data: Model }
  | { readonly success: false; readonly error: OperationFailure };

/**
 * Returns a new model with `element` appended to the diagram named by
 * `diagramId`. Any element kind adds this way, flows and trust boundaries
 * included. Fails when the diagram is unknown, when the element's id is
 * already taken anywhere in the model, or when an attached flow endpoint
 * references the flow itself or an element outside the target diagram.
 * The element value comes from the element schema; what this operation
 * checks is its fit against the model.
 */
export function addElement(
  model: Model,
  diagramId: DiagramId,
  element: Element,
): OperationResult {
  const diagramIndex = model.diagrams.findIndex(
    (diagram) => diagram.id === diagramId,
  );
  if (diagramIndex === -1) {
    return failure({ kind: 'unknown-diagram', diagramId });
  }
  if (
    model.diagrams.some((diagram) =>
      diagram.elements.some((existing) => existing.id === element.id),
    )
  ) {
    return failure({ kind: 'duplicate-element-id', elementId: element.id });
  }
  const endpointFailure = flowEndpointFailure(
    element,
    model.diagrams[diagramIndex],
  );
  if (endpointFailure) {
    return failure(endpointFailure);
  }
  return success(
    withDiagram(model, diagramIndex, (diagram) => ({
      ...diagram,
      elements: [...diagram.elements, element],
    })),
  );
}

/**
 * Returns a new model without the element named by `elementId`, cascading
 * so the rest of the model stays consistent: a flow endpoint attached to
 * the removed element becomes a free endpoint, and threats and assumptions
 * lose the removed element from their `elements` links while the records
 * themselves stay. A freed endpoint lands on the removed element's anchor
 * point: the centre of a node or box boundary, the first waypoint of a
 * curve boundary, and for a flow its first waypoint, else a free
 * endpoint's position, else the canvas origin. Fails when the element is
 * unknown.
 */
export function removeElement(
  model: Model,
  elementId: ElementId,
): OperationResult {
  const located = locateElement(model, elementId);
  if (!located) {
    return failure({ kind: 'unknown-element', elementId });
  }
  const freed: FlowEndpoint = {
    kind: 'free',
    position: anchorPoint(located.element),
  };
  const detached = (endpoint: FlowEndpoint): FlowEndpoint =>
    endpoint.kind === 'attached' && endpoint.element === elementId
      ? freed
      : endpoint;
  const trimmed = withDiagram(model, located.diagramIndex, (diagram) => ({
    ...diagram,
    elements: diagram.elements
      .filter((element) => element.id !== elementId)
      .map((element) =>
        element.kind === 'flow'
          ? {
              ...element,
              source: detached(element.source),
              target: detached(element.target),
            }
          : element,
      ),
  }));
  return success({
    ...trimmed,
    threats: trimmed.threats.map((threat) => ({
      ...threat,
      elements: threat.elements.filter((id) => id !== elementId),
    })),
    assumptions: trimmed.assumptions.map((assumption) => ({
      ...assumption,
      elements: assumption.elements.filter((id) => id !== elementId),
    })),
  });
}

/**
 * Returns a new model with the element named by `elementId` translated by
 * `offset`, a displacement in canvas units: a node or box boundary shifts
 * its position, a curve boundary its waypoints, and a flow its waypoints
 * and free endpoints, while attached endpoints keep following their
 * element. Fails when the element is unknown.
 */
export function moveElement(
  model: Model,
  elementId: ElementId,
  offset: Point,
): OperationResult {
  const located = locateElement(model, elementId);
  if (!located) {
    return failure({ kind: 'unknown-element', elementId });
  }
  return success(
    withElement(
      model,
      located.diagramIndex,
      translated(located.element, offset),
    ),
  );
}

/**
 * Returns a new model with the element named by `elementId` given `size`.
 * Only elements carrying an extent resize: actors, processes, stores, and
 * box trust boundaries. Fails when the element is unknown and refuses a
 * flow or a curve boundary as `not-resizable`. The size value comes from
 * the size schema, which keeps extents strictly positive.
 */
export function resizeElement(
  model: Model,
  elementId: ElementId,
  size: Size,
): OperationResult {
  const located = locateElement(model, elementId);
  if (!located) {
    return failure({ kind: 'unknown-element', elementId });
  }
  const next = resized(located.element, size);
  if (!next) {
    return failure({ kind: 'not-resizable', elementId });
  }
  return success(withElement(model, located.diagramIndex, next));
}

function success(model: Model): OperationResult {
  return { success: true, data: model };
}

function failure(error: OperationFailure): OperationResult {
  return { success: false, error };
}

type LocatedElement = {
  diagramIndex: number;
  element: Element;
};

function locateElement(
  model: Model,
  elementId: ElementId,
): LocatedElement | undefined {
  for (const [diagramIndex, diagram] of model.diagrams.entries()) {
    const element = diagram.elements.find(
      (candidate) => candidate.id === elementId,
    );
    if (element) {
      return { diagramIndex, element };
    }
  }
  return undefined;
}

function withDiagram(
  model: Model,
  diagramIndex: number,
  update: (diagram: Diagram) => Diagram,
): Model {
  return {
    ...model,
    diagrams: model.diagrams.map((diagram, index) =>
      index === diagramIndex ? update(diagram) : diagram,
    ),
  };
}

function withElement(model: Model, diagramIndex: number, next: Element): Model {
  return withDiagram(model, diagramIndex, (diagram) => ({
    ...diagram,
    elements: diagram.elements.map((element) =>
      element.id === next.id ? next : element,
    ),
  }));
}

function flowEndpointFailure(
  element: Element,
  diagram: Diagram,
): OperationFailure | undefined {
  if (element.kind !== 'flow') {
    return undefined;
  }
  const diagramElementIds = new Set<string>(
    diagram.elements.map((existing) => existing.id),
  );
  for (const side of ['source', 'target'] as const) {
    const endpoint = element[side];
    if (
      endpoint.kind === 'attached' &&
      (endpoint.element === element.id ||
        !diagramElementIds.has(endpoint.element))
    ) {
      return {
        kind: 'invalid-flow-endpoint',
        side,
        reference: endpoint.element,
      };
    }
  }
  return undefined;
}

const origin: Point = { x: 0, y: 0 };

function anchorPoint(element: Element): Point {
  if (element.kind === 'flow') {
    return element.waypoints.at(0) ?? freeEndpointPosition(element) ?? origin;
  }
  if (element.kind === 'trust-boundary') {
    return element.shape.kind === 'box'
      ? centreOf(element.shape.position, element.shape.size)
      : element.shape.waypoints[0];
  }
  return centreOf(element.position, element.size);
}

function centreOf(position: Point, size: Size): Point {
  return {
    x: position.x + size.width / 2,
    y: position.y + size.height / 2,
  };
}

function freeEndpointPosition(flow: Flow): Point | undefined {
  if (flow.source.kind === 'free') {
    return flow.source.position;
  }
  return flow.target.kind === 'free' ? flow.target.position : undefined;
}

function translated(element: Element, offset: Point): Element {
  if (element.kind === 'flow') {
    return {
      ...element,
      source: shiftedEndpoint(element.source, offset),
      target: shiftedEndpoint(element.target, offset),
      waypoints: element.waypoints.map((waypoint) => shifted(waypoint, offset)),
    };
  }
  if (element.kind === 'trust-boundary') {
    return { ...element, shape: shiftedShape(element.shape, offset) };
  }
  return { ...element, position: shifted(element.position, offset) };
}

function shifted(point: Point, offset: Point): Point {
  return { x: point.x + offset.x, y: point.y + offset.y };
}

function shiftedEndpoint(endpoint: FlowEndpoint, offset: Point): FlowEndpoint {
  return endpoint.kind === 'free'
    ? { ...endpoint, position: shifted(endpoint.position, offset) }
    : endpoint;
}

function shiftedShape(shape: BoundaryShape, offset: Point): BoundaryShape {
  return shape.kind === 'box'
    ? { ...shape, position: shifted(shape.position, offset) }
    : {
        ...shape,
        waypoints: shape.waypoints.map((waypoint) => shifted(waypoint, offset)),
      };
}

function resized(element: Element, size: Size): Element | undefined {
  if (element.kind === 'flow') {
    return undefined;
  }
  if (element.kind === 'trust-boundary') {
    return element.shape.kind === 'box'
      ? { ...element, shape: { ...element.shape, size } }
      : undefined;
  }
  return { ...element, size };
}
