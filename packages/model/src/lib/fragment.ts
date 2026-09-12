import { restrictRelationships } from './relationships.js';
import { Either } from 'effect';
import type { DiagramId, ElementId } from './ids.js';
import { OperationFailure } from './operation-failures.js';
import { parseModel, type Model } from './parse.js';
import { translatedElement } from './operations.js';
import type { Point } from './geometry.js';

/** Copies a selection and its flow endpoints, with related records restricted to the copied graph. */
export function selectionFragment(
  model: Model,
  diagramId: DiagramId,
  selection: readonly ElementId[],
): Either.Either<Model, OperationFailure> {
  const diagram = model.diagrams.find(
    (candidate) => candidate.id === diagramId,
  );
  if (diagram === undefined) {
    return Either.left(OperationFailure.UnknownDiagram({ diagramId }));
  }
  const known = new Map(
    diagram.elements.map((element) => [element.id, element]),
  );
  const included = new Set(selection);
  for (const id of included) {
    const element = known.get(id);
    if (element === undefined) {
      return Either.left(OperationFailure.UnknownElement({ elementId: id }));
    }
    if (element.kind === 'flow') {
      for (const end of [element.source, element.target]) {
        if (end.kind === 'attached') {
          included.add(end.element);
        }
      }
    }
  }
  for (const element of diagram.elements) {
    if (
      element.kind === 'flow' &&
      element.source.kind === 'attached' &&
      element.target.kind === 'attached' &&
      included.has(element.source.element) &&
      included.has(element.target.element)
    ) {
      included.add(element.id);
    }
  }
  const elements = diagram.elements
    .filter((element) => included.has(element.id))
    .map((element) => restrictRelationships(element, included));
  const threats = model.threats
    .filter((threat) => threat.elements.some((id) => included.has(id)))
    .map((threat) => ({
      ...threat,
      elements: threat.elements.filter((id) => included.has(id)),
    }));
  const threatIds = new Set(threats.map((threat) => threat.id));
  return checkedFragment({
    ...model,
    diagrams: [{ ...diagram, elements }],
    threats,
    mitigations: model.mitigations
      .filter((item) => item.threats.some((id) => threatIds.has(id)))
      .map((item) => ({
        ...item,
        threats: item.threats.filter((id) => threatIds.has(id)),
      })),
    assumptions: model.assumptions
      .filter(
        (item) =>
          item.elements.some((id) => included.has(id)) ||
          item.threats.some((id) => threatIds.has(id)),
      )
      .map((item) => ({
        ...item,
        elements: item.elements.filter((id) => included.has(id)),
        threats: item.threats.filter((id) => threatIds.has(id)),
      })),
  });
}

/** Remaps every record ID under a fresh prefix and translates copied geometry. */
export function remapFragment(
  fragment: Model,
  prefix: string,
  offset: Point,
): Either.Either<Model, OperationFailure> {
  const renamed = (id: string) => prefix + ':' + id;
  return checkedFragment({
    ...fragment,
    diagrams: fragment.diagrams.map((diagram) => ({
      ...diagram,
      id: renamed(diagram.id),
      elements: diagram.elements.map((original) => {
        const element = translatedElement(original, offset);
        return element.kind === 'flow'
          ? {
              ...element,
              id: renamed(element.id),
              ...(element.trustBoundaryIds === undefined
                ? {}
                : { trustBoundaryIds: element.trustBoundaryIds.map(renamed) }),
              source:
                element.source.kind === 'attached'
                  ? {
                      ...element.source,
                      element: renamed(element.source.element),
                    }
                  : element.source,
              target:
                element.target.kind === 'attached'
                  ? {
                      ...element.target,
                      element: renamed(element.target.element),
                    }
                  : element.target,
            }
          : element.kind === 'trust-boundary'
            ? {
                ...element,
                id: renamed(element.id),
                ...(element.containedElements === undefined
                  ? {}
                  : {
                      containedElements: element.containedElements.map(renamed),
                    }),
                ...(element.crossingFlows === undefined
                  ? {}
                  : { crossingFlows: element.crossingFlows.map(renamed) }),
              }
            : { ...element, id: renamed(element.id) };
      }),
    })),
    threats: fragment.threats.map((item) => ({
      ...item,
      id: renamed(item.id),
      elements: item.elements.map(renamed),
    })),
    mitigations: fragment.mitigations.map((item) => ({
      ...item,
      id: renamed(item.id),
      threats: item.threats.map(renamed),
    })),
    assumptions: fragment.assumptions.map((item) => ({
      ...item,
      id: renamed(item.id),
      elements: item.elements.map(renamed),
      threats: item.threats.map(renamed),
    })),
  });
}

/** Inserts one copied graph atomically and issues new threat numbers. */
export function insertFragment(
  model: Model,
  diagramId: DiagramId,
  fragment: Model,
): Either.Either<Model, OperationFailure> {
  if (!model.diagrams.some((diagram) => diagram.id === diagramId)) {
    return Either.left(OperationFailure.UnknownDiagram({ diagramId }));
  }
  const elements = fragment.diagrams.flatMap((diagram) => diagram.elements);
  if (elements.length === 0) {
    return Either.right(model);
  }
  return checkedFragment({
    ...model,
    diagrams: model.diagrams.map((diagram) =>
      diagram.id === diagramId
        ? { ...diagram, elements: [...diagram.elements, ...elements] }
        : diagram,
    ),
    threats: [
      ...model.threats,
      ...fragment.threats.map((threat, index) => ({
        ...threat,
        number: model.lastIssuedThreatNumber + index + 1,
      })),
    ],
    lastIssuedThreatNumber:
      model.lastIssuedThreatNumber + fragment.threats.length,
    mitigations: [...model.mitigations, ...fragment.mitigations],
    assumptions: [...model.assumptions, ...fragment.assumptions],
  });
}

function checkedFragment(
  input: unknown,
): Either.Either<Model, OperationFailure> {
  return Either.mapLeft(parseModel(input), ({ issues }) =>
    OperationFailure.InvalidFragment({ issues }),
  );
}
