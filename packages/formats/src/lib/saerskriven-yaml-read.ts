import {
  actorProperties,
  processProperties,
  storeProperties,
  flowProperties,
  boundaryProperties,
} from './security-properties.js';
import {
  assumptionSchema,
  boundaryShapeSchema,
  diagramSchema,
  elementSchema,
  flowEndpointSchema,
  mitigationSchema,
  modelMetadataSchema,
  parseModel,
  threatSchema,
  toParseIssues,
  type Model,
} from '@saerskriven/model';
import {
  saerskrivenYamlWireSchema,
  type SaerskrivenYamlAssumption,
  type SaerskrivenYamlBoundaryShape,
  type SaerskrivenYamlDiagram,
  type SaerskrivenYamlDocument,
  type SaerskrivenYamlElement,
  type SaerskrivenYamlEndpoint,
  type SaerskrivenYamlMetadata,
  type SaerskrivenYamlMitigation,
  type SaerskrivenYamlThreat,
} from '@saerskriven/wire-saerskriven-yaml';
import { Either } from 'effect';
import type { z } from 'zod';
import { ReadFailure, type ReadResult } from './codec.js';
import {
  assumptionStatusesToModel,
  mitigationStatusesToModel,
  severitiesToModel,
  threatStatusesToModel,
  toModelCategory,
} from './saerskriven-yaml-vocabulary.js';
import { parseYaml } from './parse-yaml.js';
import { undeclaredDivergences } from './undeclared.js';

type MetadataInput = z.input<typeof modelMetadataSchema>;
type DiagramInput = z.input<typeof diagramSchema>;
type ElementInput = z.input<typeof elementSchema>;
type EndpointInput = z.input<typeof flowEndpointSchema>;
type BoundaryShapeInput = z.input<typeof boundaryShapeSchema>;
type ThreatInput = z.input<typeof threatSchema>;
type MitigationInput = z.input<typeof mitigationSchema>;
type AssumptionInput = z.input<typeof assumptionSchema>;

/** Reads native YAML and retains its wire document for subsequent saves. */
export function readSaerskrivenYaml(
  text: string,
): Either.Either<ReadResult<typeof saerskrivenYamlWireSchema>, ReadFailure> {
  return Either.flatMap(parseYaml(text), mapDocument);
}

/** Maps a validated wire document. Absent security facts remain unknown. */
export function readSaerskrivenYamlDocument(
  document: SaerskrivenYamlDocument,
): Either.Either<Model, ReadFailure> {
  return Either.mapLeft(parseModel(toModelInput(document)), (failure) =>
    ReadFailure.InvalidModel({ issues: failure.issues }),
  );
}

function mapDocument(
  given: unknown,
): Either.Either<ReadResult<typeof saerskrivenYamlWireSchema>, ReadFailure> {
  const wire = saerskrivenYamlWireSchema.safeParse(given);
  if (!wire.success) {
    return Either.left(
      ReadFailure.InvalidWireDocument({
        issues: toParseIssues(wire.error.issues),
      }),
    );
  }
  return Either.map(readSaerskrivenYamlDocument(wire.data), (model) => ({
    model,
    source: wire.data,
    divergences: undeclaredDivergences(given, wire.data),
  }));
}

function toModelInput(document: SaerskrivenYamlDocument) {
  return {
    metadata: toMetadata(document.metadata),
    diagrams: document.diagrams.map(toDiagram),
    threats: document.threats.map(toThreat),
    lastIssuedThreatNumber: document.lastIssuedThreatNumber,
    mitigations: document.mitigations.map(toMitigation),
    assumptions: document.assumptions.map(toAssumption),
  };
}

function toMetadata(metadata: SaerskrivenYamlMetadata): MetadataInput {
  return {
    title: metadata.title,
    owner: metadata.owner,
    description: metadata.description,
    contributors: metadata.contributors,
  };
}

function toDiagram(diagram: SaerskrivenYamlDiagram): DiagramInput {
  return {
    id: diagram.id,
    title: diagram.title,
    elements: diagram.elements.map(toElement),
  };
}

function toElement(element: SaerskrivenYamlElement): ElementInput {
  if (element.kind === 'flow') {
    return {
      kind: 'flow',
      ...flowProperties(element),
      ...toCommon(element),
      source: toEndpoint(element.source),
      target: toEndpoint(element.target),
      waypoints: element.waypoints,
      bidirectional: element.bidirectional ?? false,
    };
  }
  if (element.kind === 'trust-boundary') {
    return {
      kind: 'trust-boundary',
      ...boundaryProperties(element),
      ...toCommon(element),
      shape: toBoundaryShape(element.shape),
    };
  }
  if (element.kind === 'text') {
    return {
      kind: 'text',
      ...toCommon(element),
      position: element.position,
      size: element.size,
      text: element.text,
    };
  }
  const node = {
    ...toCommon(element),
    position: element.position,
    size: element.size,
  };
  if (element.kind === 'actor') {
    return { kind: 'actor', ...node, ...actorProperties(element) };
  }
  if (element.kind === 'process') {
    return { kind: 'process', ...node, ...processProperties(element) };
  }
  return { kind: 'store', ...node, ...storeProperties(element) };
}

function toCommon(element: SaerskrivenYamlElement) {
  return {
    id: element.id,
    name: element.name,
    description: element.description,
    outOfScope: element.outOfScope,
    reasonOutOfScope: element.reasonOutOfScope,
  };
}

function toEndpoint(endpoint: SaerskrivenYamlEndpoint): EndpointInput {
  if (endpoint.kind === 'free') {
    return { kind: 'free', position: endpoint.position };
  }
  return endpoint.side === undefined
    ? { kind: 'attached', element: endpoint.element }
    : { kind: 'attached', element: endpoint.element, side: endpoint.side };
}

function toBoundaryShape(
  shape: SaerskrivenYamlBoundaryShape,
): BoundaryShapeInput {
  return shape.kind === 'box'
    ? { kind: 'box', position: shape.position, size: shape.size }
    : { kind: 'curve', waypoints: shape.waypoints };
}

function toThreat(threat: SaerskrivenYamlThreat): ThreatInput {
  return {
    id: threat.id,
    number: threat.number,
    title: threat.title,
    category: toModelCategory(threat.category),
    severity: severitiesToModel[threat.severity],
    status: threatStatusesToModel[threat.status],
    description: threat.description,
    mitigation: threat.mitigation,
    elements: threat.elements,
  };
}

function toMitigation(mitigation: SaerskrivenYamlMitigation): MitigationInput {
  return {
    id: mitigation.id,
    title: mitigation.title,
    prose: mitigation.prose,
    status: mitigationStatusesToModel[mitigation.status],
    threats: mitigation.threats,
  };
}

function toAssumption(assumption: SaerskrivenYamlAssumption): AssumptionInput {
  return {
    id: assumption.id,
    prose: assumption.prose,
    status: assumptionStatusesToModel[assumption.status],
    elements: assumption.elements,
    threats: assumption.threats,
  };
}
