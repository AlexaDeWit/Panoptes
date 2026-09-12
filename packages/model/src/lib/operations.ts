import {
  elementPropertiesSchema,
  type ElementProperties,
} from './element-properties.js';
import { elementSchema } from './elements.js';
import { toParseIssues } from './parse.js';
import { relationshipIssues, restrictRelationships } from './relationships.js';
import { Either } from 'effect';
import type { BoundaryShape, Element, Flow, FlowEndpoint } from './elements.js';
import type { Point, Side, Size } from './geometry.js';
import type { DiagramId, ElementId } from './ids.js';
import type { Diagram } from './model.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import {
  elementIdsAcross,
  elementIdsIn,
  endpointViolationsOf,
} from './references.js';
import { firstRefusedCharacter, isEmptyName } from './text.js';

/** The failures {@link addElement} can produce. */
export type AddElementFailure = Extract<
  OperationFailure,
  {
    _tag:
      | 'UnknownDiagram'
      | 'DuplicateElementId'
      | 'InvalidFlowEndpoint'
      | 'InvalidElementRelationship';
  }
>;

/** The failure {@link removeElement} can produce. */
export type RemoveElementFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' }
>;

/** The failure {@link moveElement} can produce. */
export type MoveElementFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' }
>;

/** The failures {@link resizeElement} can produce. */
export type ResizeElementFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' | 'NotResizable' }
>;

/** The failures {@link renameElement} can produce. */
export type RenameElementFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' | 'EmptyName' | 'RefusedCharacter' }
>;

/** The failures {@link editNote} can produce. */
export type EditNoteFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' | 'NotTextElement' | 'RefusedCharacter' }
>;

/** The failures {@link addDiagram} can produce. */
export type AddDiagramFailure = Extract<
  OperationFailure,
  {
    _tag:
      | 'DuplicateDiagramId'
      | 'DuplicateElementId'
      | 'InvalidFlowEndpoint'
      | 'InvalidElementRelationship'
      | 'EmptyTitle'
      | 'RefusedTitleCharacter';
  }
>;

/** The failures {@link renameDiagram} can produce. */
export type RenameDiagramFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownDiagram' | 'EmptyTitle' | 'RefusedTitleCharacter' }
>;

/** The failures {@link removeDiagram} can produce. */
export type RemoveDiagramFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownDiagram' | 'DiagramNotEmpty' }
>;

/** The failures an edit of one flow's route, anchors, or direction can produce. */
export type FlowEditFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' | 'NotFlowElement' }
>;

/** Replaces a flow's ordered bends, preserving the model for an unchanged route. */
export function setFlowWaypoints(
  model: Model,
  elementId: ElementId,
  waypoints: readonly Point[],
): Either.Either<Model, FlowEditFailure> {
  return Either.map(locateFlow(model, elementId), (located) => {
    const flow = located.element;
    const unchanged =
      flow.waypoints.length === waypoints.length &&
      flow.waypoints.every(
        (point, index) =>
          point.x === waypoints[index].x && point.y === waypoints[index].y,
      );
    return unchanged
      ? model
      : withElement(model, located.diagramIndex, {
          ...flow,
          waypoints: waypoints.map((point) => ({ ...point })),
        });
  });
}

/** Reattaches an endpoint inside its diagram. An absent anchor releases its pinned side. */
export function reconnectFlow(
  model: Model,
  elementId: ElementId,
  side: 'source' | 'target',
  endpointId: ElementId,
  anchor?: Side,
): Either.Either<Model, OperationFailure> {
  return Either.flatMap(locateFlow(model, elementId), (located) => {
    const flow = located.element;
    const endpoint = model.diagrams[located.diagramIndex].elements.find(
      (element) => element.id === endpointId,
    );
    const other = side === 'source' ? flow.target : flow.source;
    if (
      endpoint === undefined ||
      !['actor', 'process', 'store'].includes(endpoint.kind) ||
      (other.kind === 'attached' && other.element === endpointId)
    ) {
      return Either.left(
        OperationFailure.InvalidFlowEndpoint({ side, reference: endpointId }),
      );
    }
    const previous = flow[side];
    return Either.right(
      previous.kind === 'attached' &&
        previous.element === endpointId &&
        previous.side === anchor
        ? model
        : withElement(model, located.diagramIndex, {
            ...flow,
            [side]: attachedEndpoint(endpointId, anchor),
          }),
    );
  });
}

/** Makes a flow bidirectional or one-way, preserving the model where it already is. */
export function setFlowDirection(
  model: Model,
  elementId: ElementId,
  bidirectional: boolean,
): Either.Either<Model, FlowEditFailure> {
  return Either.map(locateFlow(model, elementId), (located) =>
    located.element.bidirectional === bidirectional
      ? model
      : withElement(model, located.diagramIndex, {
          ...located.element,
          bidirectional,
        }),
  );
}

/** Requires an existing diagram, a new ID and valid local endpoint and boundary references. */
export function addElement(
  model: Model,
  diagramId: DiagramId,
  element: Element,
): Either.Either<Model, AddElementFailure> {
  const diagramIndex = model.diagrams.findIndex(
    (diagram) => diagram.id === diagramId,
  );
  if (diagramIndex === -1) {
    return Either.left(OperationFailure.UnknownDiagram({ diagramId }));
  }
  if (elementIdsAcross(model.diagrams).has(element.id)) {
    return Either.left(
      OperationFailure.DuplicateElementId({ elementId: element.id }),
    );
  }
  const endpointFailure = flowEndpointFailure(
    element,
    model.diagrams[diagramIndex],
  );
  if (endpointFailure) {
    return Either.left(endpointFailure);
  }
  const relationshipFailure = invalidRelationships(
    element,
    new Map(
      [...model.diagrams[diagramIndex].elements, element].map((candidate) => [
        candidate.id,
        candidate,
      ]),
    ),
  );
  if (relationshipFailure !== undefined) {
    return Either.left(relationshipFailure);
  }
  return Either.right(
    withDiagram(model, diagramIndex, (diagram) => ({
      ...diagram,
      elements: [...diagram.elements, element],
    })),
  );
}

/** Validates a property edit for the existing element kind. Unknown values clear only explicitly named fields. */
export function setElementProperties(
  model: Model,
  elementId: ElementId,
  properties: ElementProperties,
): Either.Either<Model, OperationFailure> {
  const located = locateElement(model, elementId);
  if (located === undefined) {
    return Either.left(OperationFailure.UnknownElement({ elementId }));
  }
  const parsed = elementPropertiesSchema.safeParse(properties);
  if (!parsed.success) {
    return Either.left(
      OperationFailure.InvalidElementProperties({
        elementId,
        issues: toParseIssues(parsed.error.issues),
      }),
    );
  }
  if (parsed.data.kind !== located.element.kind) {
    return Either.left(
      OperationFailure.InvalidElementProperties({
        elementId,
        issues: [
          {
            path: ['kind'],
            code: 'custom',
            message: 'Properties must match the existing element kind.',
          },
        ],
      }),
    );
  }
  const previous = new Map<string, unknown>(Object.entries(located.element));
  const changed = Object.entries(parsed.data).some(([key, value]) => {
    const held = previous.get(key);
    return Array.isArray(value) && Array.isArray(held)
      ? value.length !== held.length ||
          value.some((id, index) => id !== held[index])
      : value !== held;
  });
  if (!changed) {
    return Either.right(model);
  }
  const candidate = { ...located.element, ...parsed.data };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) {
      Reflect.deleteProperty(candidate, key);
    }
  }
  const next = elementSchema.safeParse(candidate);
  if (!next.success) {
    return Either.left(
      OperationFailure.InvalidElementProperties({
        elementId,
        issues: toParseIssues(next.error.issues),
      }),
    );
  }
  const diagram = model.diagrams[located.diagramIndex];
  const failure = invalidRelationships(
    next.data,
    new Map(diagram.elements.map((element) => [element.id, element])),
  );
  return failure === undefined
    ? Either.right(withElement(model, located.diagramIndex, next.data))
    : Either.left(failure);
}

/** Removes an element and its threat, assumption and boundary references. Attached flows keep their identity and acquire free endpoints at the removed element's anchor. */
export function removeElement(
  model: Model,
  elementId: ElementId,
): Either.Either<Model, RemoveElementFailure> {
  const located = locateElement(model, elementId);
  if (!located) {
    return Either.left(OperationFailure.UnknownElement({ elementId }));
  }
  const freed: FlowEndpoint = {
    kind: 'free',
    position: anchorPoint(located.element),
  };
  const detached = (endpoint: FlowEndpoint): FlowEndpoint =>
    endpoint.kind === 'attached' && endpoint.element === elementId
      ? freed
      : endpoint;
  const retained = elementIdsIn(model.diagrams[located.diagramIndex]);
  retained.delete(elementId);
  const trimmed = withDiagram(model, located.diagramIndex, (diagram) => ({
    ...diagram,
    elements: diagram.elements
      .filter((element) => element.id !== elementId)
      .map((element) => restrictRelationships(element, retained))
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
  return Either.right({
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

/** Translates positions, waypoints, and free endpoints. Attached endpoints keep following their elements. */
export function moveElement(
  model: Model,
  elementId: ElementId,
  offset: Point,
): Either.Either<Model, MoveElementFailure> {
  const located = locateElement(model, elementId);
  if (!located) {
    return Either.left(OperationFailure.UnknownElement({ elementId }));
  }
  return Either.right(
    withElement(
      model,
      located.diagramIndex,
      translatedElement(located.element, offset),
    ),
  );
}

/** Translates element geometry while attached endpoints retain their references. */
export function translatedElement(element: Element, offset: Point): Element {
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

/** Resizes an element that carries an extent. The caller supplies a schema-valid size. */
export function resizeElement(
  model: Model,
  elementId: ElementId,
  size: Size,
): Either.Either<Model, ResizeElementFailure> {
  const located = locateElement(model, elementId);
  if (!located) {
    return Either.left(OperationFailure.UnknownElement({ elementId }));
  }
  const next = resized(located.element, size);
  if (!next) {
    return Either.left(OperationFailure.NotResizable({ elementId }));
  }
  return Either.right(withElement(model, located.diagramIndex, next));
}

/** Renames any element, rejecting empty names and characters refused by the model. */
export function renameElement(
  model: Model,
  elementId: ElementId,
  name: string,
): Either.Either<Model, RenameElementFailure> {
  const located = locateElement(model, elementId);
  if (!located) {
    return Either.left(OperationFailure.UnknownElement({ elementId }));
  }
  if (isEmptyName(name)) {
    return Either.left(OperationFailure.EmptyName({ elementId }));
  }
  const refusal = refusedCharacter(elementId, name);
  if (refusal !== undefined) {
    return Either.left(refusal);
  }
  return Either.right(
    withElement(model, located.diagramIndex, { ...located.element, name }),
  );
}

/** Changes a canvas note's text. Empty text is valid. */
export function editNote(
  model: Model,
  elementId: ElementId,
  text: string,
): Either.Either<Model, EditNoteFailure> {
  const located = locateElement(model, elementId);
  if (!located) {
    return Either.left(OperationFailure.UnknownElement({ elementId }));
  }
  if (located.element.kind !== 'text') {
    return Either.left(OperationFailure.NotTextElement({ elementId }));
  }
  const refusal = refusedCharacter(elementId, text);
  if (refusal !== undefined) {
    return Either.left(refusal);
  }
  return Either.right(
    withElement(model, located.diagramIndex, { ...located.element, text }),
  );
}

/** Appends a diagram with a valid title, new element IDs and valid local endpoint and boundary references. */
export function addDiagram(
  model: Model,
  diagram: Diagram,
): Either.Either<Model, AddDiagramFailure> {
  if (model.diagrams.some((existing) => existing.id === diagram.id)) {
    return Either.left(
      OperationFailure.DuplicateDiagramId({ diagramId: diagram.id }),
    );
  }
  const titleRefusal = refusedTitle(diagram.id, diagram.title);
  if (titleRefusal !== undefined) {
    return Either.left(titleRefusal);
  }
  const taken = elementIdsAcross(model.diagrams);
  const own = new Set<string>();
  for (const element of diagram.elements) {
    if (taken.has(element.id) || own.has(element.id)) {
      return Either.left(
        OperationFailure.DuplicateElementId({ elementId: element.id }),
      );
    }
    own.add(element.id);
  }
  const known = new Map(
    diagram.elements.map((element) => [element.id, element]),
  );
  for (const element of diagram.elements) {
    const failure =
      flowEndpointFailure(element, diagram) ??
      invalidRelationships(element, known);
    if (failure !== undefined) {
      return Either.left(failure);
    }
  }
  return Either.right({ ...model, diagrams: [...model.diagrams, diagram] });
}

/** Retitles a diagram, rejecting empty titles and characters refused by the model. */
export function renameDiagram(
  model: Model,
  diagramId: DiagramId,
  title: string,
): Either.Either<Model, RenameDiagramFailure> {
  const diagramIndex = model.diagrams.findIndex(
    (diagram) => diagram.id === diagramId,
  );
  if (diagramIndex < 0) {
    return Either.left(OperationFailure.UnknownDiagram({ diagramId }));
  }
  const refusal = refusedTitle(diagramId, title);
  if (refusal !== undefined) {
    return Either.left(refusal);
  }
  return Either.right(
    withDiagram(model, diagramIndex, (diagram) => ({ ...diagram, title })),
  );
}

/** Removes only an empty diagram. Explicit element deletion must precede diagram deletion. */
export function removeDiagram(
  model: Model,
  diagramId: DiagramId,
): Either.Either<Model, RemoveDiagramFailure> {
  const diagram = model.diagrams.find(
    (candidate) => candidate.id === diagramId,
  );
  if (diagram === undefined) {
    return Either.left(OperationFailure.UnknownDiagram({ diagramId }));
  }
  if (diagram.elements.length > 0) {
    return Either.left(
      OperationFailure.DiagramNotEmpty({
        diagramId,
        elements: diagram.elements.length,
      }),
    );
  }
  return Either.right({
    ...model,
    diagrams: model.diagrams.filter((candidate) => candidate.id !== diagramId),
  });
}

function attachedEndpoint(
  element: ElementId,
  side: Side | undefined,
): FlowEndpoint {
  return side === undefined
    ? { kind: 'attached', element }
    : { kind: 'attached', element, side };
}

function refusedTitle(
  diagramId: DiagramId,
  title: string,
):
  | Extract<OperationFailure, { _tag: 'EmptyTitle' | 'RefusedTitleCharacter' }>
  | undefined {
  if (isEmptyName(title)) {
    return OperationFailure.EmptyTitle({ diagramId });
  }
  const at = firstRefusedCharacter(title);
  return at === undefined
    ? undefined
    : OperationFailure.RefusedTitleCharacter({ diagramId, at });
}

function refusedCharacter(
  elementId: ElementId,
  text: string,
): Extract<OperationFailure, { _tag: 'RefusedCharacter' }> | undefined {
  const at = firstRefusedCharacter(text);
  return at === undefined
    ? undefined
    : OperationFailure.RefusedCharacter({ elementId, at });
}

type LocatedElement = {
  diagramIndex: number;
  element: Element;
};

type LocatedFlow = {
  diagramIndex: number;
  element: Flow;
};

function locateFlow(
  model: Model,
  elementId: ElementId,
): Either.Either<LocatedFlow, FlowEditFailure> {
  const located = locateElement(model, elementId);
  if (located === undefined) {
    return Either.left(OperationFailure.UnknownElement({ elementId }));
  }
  return located.element.kind === 'flow'
    ? Either.right({
        diagramIndex: located.diagramIndex,
        element: located.element,
      })
    : Either.left(OperationFailure.NotFlowElement({ elementId }));
}

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
): Extract<OperationFailure, { _tag: 'InvalidFlowEndpoint' }> | undefined {
  if (element.kind !== 'flow') {
    return undefined;
  }
  const violation = endpointViolationsOf(element, elementIdsIn(diagram)).at(0);
  return violation
    ? OperationFailure.InvalidFlowEndpoint({
        side: violation.side,
        reference: violation.reference,
      })
    : undefined;
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
  return [flow.source, flow.target]
    .flatMap((endpoint) =>
      endpoint.kind === 'free' ? [endpoint.position] : [],
    )
    .at(0);
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

function invalidRelationships(
  element: Element,
  known: ReadonlyMap<ElementId, Element>,
):
  | Extract<OperationFailure, { _tag: 'InvalidElementRelationship' }>
  | undefined {
  const issues = relationshipIssues(element, known);
  return issues.length === 0
    ? undefined
    : OperationFailure.InvalidElementRelationship({
        elementId: element.id,
        issues,
      });
}
