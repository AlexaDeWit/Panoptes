import {
  actorProperties,
  processProperties,
  storeProperties,
  flowProperties,
  boundaryProperties,
} from './security-properties.js';
import type {
  Assumption,
  BoundaryShape,
  Diagram,
  Element,
  FlowEndpoint,
  Mitigation,
  Model,
  ModelMetadata,
  Threat,
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
import { stringify } from 'yaml';
import { canonicalOrder } from './canonical-order.js';
import type { WriteResult } from './codec.js';
import { noDivergence } from './divergence.js';
import {
  assumptionStatusesToWire,
  mitigationStatusesToWire,
  severitiesToWire,
  threatStatusesToWire,
  toWireCategory,
} from './saerskriven-yaml-vocabulary.js';

const stringifyOptions = { lineWidth: 0 };

/** Writes canonical native YAML without wrapping prose. The source cannot override the model. */
export function writeSaerskrivenYaml(
  model: Model,
  _source?: SaerskrivenYamlDocument,
): WriteResult {
  return {
    output: stringify(
      canonicalOrder(
        saerskrivenYamlWireSchema,
        writeSaerskrivenYamlDocument(model),
      ),
      stringifyOptions,
    ),
    divergences: noDivergence,
  };
}

/** Projects model fields explicitly and orders threats by number. Other lists retain their order. */
export function writeSaerskrivenYamlDocument(
  model: Model,
): SaerskrivenYamlDocument {
  const threats = [...model.threats];
  threats.sort((left, right) => left.number - right.number);
  return {
    formatVersion: 1,
    metadata: toWireMetadata(model.metadata),
    assumptions: model.assumptions.map(toWireAssumption),
    diagrams: model.diagrams.map(toWireDiagram),
    mitigations: model.mitigations.map(toWireMitigation),
    threats: threats.map(toWireThreat),
    lastIssuedThreatNumber: model.lastIssuedThreatNumber,
  };
}

function toWireMetadata(metadata: ModelMetadata): SaerskrivenYamlMetadata {
  return {
    title: metadata.title,
    owner: metadata.owner,
    description: metadata.description,
    contributors: metadata.contributors,
  };
}

function toWireDiagram(diagram: Diagram): SaerskrivenYamlDiagram {
  return {
    id: diagram.id,
    title: diagram.title,
    elements: diagram.elements.map(toWireElement),
  };
}

function toWireElement(element: Element): SaerskrivenYamlElement {
  if (element.kind === 'flow') {
    return {
      kind: 'flow',
      ...flowProperties(element),
      ...toWireCommon(element),
      source: toWireEndpoint(element.source),
      target: toWireEndpoint(element.target),
      waypoints: element.waypoints,
      bidirectional: element.bidirectional,
    };
  }
  if (element.kind === 'trust-boundary') {
    return {
      kind: 'trust-boundary',
      ...boundaryProperties(element),
      ...toWireCommon(element),
      shape: toWireBoundaryShape(element.shape),
    };
  }
  if (element.kind === 'text') {
    return {
      kind: 'text',
      ...toWireCommon(element),
      position: element.position,
      size: element.size,
      text: element.text,
    };
  }
  const node = {
    ...toWireCommon(element),
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

function toWireCommon(element: Element) {
  return {
    id: element.id,
    name: element.name,
    description: element.description,
    outOfScope: element.outOfScope,
    reasonOutOfScope: element.reasonOutOfScope,
  };
}

function toWireEndpoint(endpoint: FlowEndpoint): SaerskrivenYamlEndpoint {
  if (endpoint.kind === 'free') {
    return { kind: 'free', position: endpoint.position };
  }
  return endpoint.side === undefined
    ? { kind: 'attached', element: endpoint.element }
    : { kind: 'attached', element: endpoint.element, side: endpoint.side };
}

function toWireBoundaryShape(
  shape: BoundaryShape,
): SaerskrivenYamlBoundaryShape {
  return shape.kind === 'box'
    ? { kind: 'box', position: shape.position, size: shape.size }
    : { kind: 'curve', waypoints: shape.waypoints };
}

function toWireThreat(threat: Threat): SaerskrivenYamlThreat {
  return {
    id: threat.id,
    number: threat.number,
    title: threat.title,
    category: toWireCategory(threat.category),
    severity: severitiesToWire[threat.severity],
    status: threatStatusesToWire[threat.status],
    description: threat.description,
    mitigation: threat.mitigation,
    elements: threat.elements,
  };
}

function toWireMitigation(mitigation: Mitigation): SaerskrivenYamlMitigation {
  return {
    id: mitigation.id,
    title: mitigation.title,
    prose: mitigation.prose,
    status: mitigationStatusesToWire[mitigation.status],
    threats: mitigation.threats,
  };
}

function toWireAssumption(assumption: Assumption): SaerskrivenYamlAssumption {
  return {
    id: assumption.id,
    prose: assumption.prose,
    status: assumptionStatusesToWire[assumption.status],
    elements: assumption.elements,
    threats: assumption.threats,
  };
}
