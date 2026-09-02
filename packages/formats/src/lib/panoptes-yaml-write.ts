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
} from '@panoptes/model';
import {
  panoptesYamlWireSchema,
  type PanoptesYamlAssumption,
  type PanoptesYamlBoundaryShape,
  type PanoptesYamlDiagram,
  type PanoptesYamlDocument,
  type PanoptesYamlElement,
  type PanoptesYamlEndpoint,
  type PanoptesYamlMetadata,
  type PanoptesYamlMitigation,
  type PanoptesYamlThreat,
} from '@panoptes/wire-panoptes-yaml';
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
} from './panoptes-yaml-vocabulary.js';

const stringifyOptions = { lineWidth: 0 };

/**
 * A model as a Panoptes YAML file. The format holds the whole model, so
 * there is nothing to leave out and the divergence list is empty by
 * construction.
 *
 * The projection is written out record by record rather than handed across,
 * for the reason the read is: the file and the model are separate
 * declarations that say the same thing today and are free to stop. Ids go
 * out as the plain strings the format holds, brands being the model's own
 * business, and vocabularies go through the tables in
 * `panoptes-yaml-vocabulary.ts`.
 *
 * Two writes of one model are byte-identical, which is what makes a model
 * file in git worth diffing. Three things fix the bytes. Keys are written in
 * the order the wire schema declares them rather than the order the model
 * records were built in, with the discriminator of a tagged variant first.
 * Threats are written in number order: a threat number is unique across the
 * model and never reissued, so ordering by it is total, and it holds a
 * threat's position in the file steady as the model is edited. And no line
 * is wrapped, so editing a sentence changes the line it is on rather than
 * reflowing the paragraph under it.
 *
 * Every other list keeps the model's order. Diagrams and elements are drawn
 * in the order they are held, so that order is information rather than
 * incidental. Mitigations and assumptions have nothing to sort on that
 * would order them any better: their ids are generated, so sorting by id
 * scatters them and drops each new record wherever its id falls, and a
 * title moves when a record is retitled.
 *
 * `source` is the contract's write signature at work: given a source
 * document a codec merges onto it, so that what it does not map is left as
 * the file had it. This format holds the whole model, so there is nothing
 * for a merge to preserve. The argument is accepted and cannot change the
 * output, and passing a document read from some other file writes this
 * model rather than that one.
 */
export function writePanoptesYaml(
  model: Model,
  _source?: PanoptesYamlDocument,
): WriteResult {
  return {
    output: stringify(
      canonicalOrder(panoptesYamlWireSchema, toDocument(model)),
      stringifyOptions,
    ),
    divergences: noDivergence,
  };
}

function toDocument(model: Model): PanoptesYamlDocument {
  const threats = [...model.threats];
  threats.sort((left, right) => left.number - right.number);
  return {
    formatVersion: 1,
    metadata: toWireMetadata(model.metadata),
    diagrams: model.diagrams.map(toWireDiagram),
    threats: threats.map(toWireThreat),
    lastIssuedThreatNumber: model.lastIssuedThreatNumber,
    mitigations: model.mitigations.map(toWireMitigation),
    assumptions: model.assumptions.map(toWireAssumption),
  };
}

function toWireMetadata(metadata: ModelMetadata): PanoptesYamlMetadata {
  return {
    title: metadata.title,
    owner: metadata.owner,
    description: metadata.description,
    contributors: metadata.contributors,
  };
}

function toWireDiagram(diagram: Diagram): PanoptesYamlDiagram {
  return {
    id: diagram.id,
    title: diagram.title,
    elements: diagram.elements.map(toWireElement),
  };
}

function toWireElement(element: Element): PanoptesYamlElement {
  if (element.kind === 'flow') {
    return {
      kind: 'flow',
      ...toWireCommon(element),
      source: toWireEndpoint(element.source),
      target: toWireEndpoint(element.target),
      waypoints: element.waypoints,
    };
  }
  if (element.kind === 'trust-boundary') {
    return {
      kind: 'trust-boundary',
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
  return {
    kind: element.kind,
    ...toWireCommon(element),
    position: element.position,
    size: element.size,
  };
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

function toWireEndpoint(endpoint: FlowEndpoint): PanoptesYamlEndpoint {
  return endpoint.kind === 'attached'
    ? { kind: 'attached', element: endpoint.element }
    : { kind: 'free', position: endpoint.position };
}

function toWireBoundaryShape(shape: BoundaryShape): PanoptesYamlBoundaryShape {
  return shape.kind === 'box'
    ? { kind: 'box', position: shape.position, size: shape.size }
    : { kind: 'curve', waypoints: shape.waypoints };
}

function toWireThreat(threat: Threat): PanoptesYamlThreat {
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

function toWireMitigation(mitigation: Mitigation): PanoptesYamlMitigation {
  return {
    id: mitigation.id,
    title: mitigation.title,
    prose: mitigation.prose,
    status: mitigationStatusesToWire[mitigation.status],
    threats: mitigation.threats,
  };
}

function toWireAssumption(assumption: Assumption): PanoptesYamlAssumption {
  return {
    id: assumption.id,
    prose: assumption.prose,
    status: assumptionStatusesToWire[assumption.status],
    elements: assumption.elements,
    threats: assumption.threats,
  };
}
