import {
  diagramSchema,
  elementSchema,
  flowEndpointSchema,
  modelMetadataSchema,
  parseModel,
  threatSchema,
  toParseIssues,
} from '@panoptes/model';
import { Either } from 'effect';
import type { z } from 'zod';
import { ReadFailure, type ReadResult } from './codec.js';
import {
  toSeverity,
  toThreatCategory,
  toThreatStatus,
} from './threat-dragon-vocabulary.js';
import {
  threatDragonWireSchema,
  type ThreatDragonCell,
  type ThreatDragonDiagram,
  type ThreatDragonDocument,
  type ThreatDragonEndpoint,
  type ThreatDragonThreat,
} from './threat-dragon-wire.js';
import { undeclaredDivergences } from './undeclared.js';

type MetadataInput = z.input<typeof modelMetadataSchema>;
type DiagramInput = z.input<typeof diagramSchema>;
type ElementInput = z.input<typeof elementSchema>;
type EndpointInput = z.input<typeof flowEndpointSchema>;
type ThreatInput = z.input<typeof threatSchema>;

type NodeCell = Extract<
  ThreatDragonCell,
  { shape: 'actor' | 'process' | 'store' }
>;

type FlowCell = Extract<ThreatDragonCell, { shape: 'flow' }>;

type BoundaryCell = Extract<
  ThreatDragonCell,
  {
    shape:
      | 'trust-boundary-box'
      | 'trust-boundary-curve'
      | 'trust-broundary-curve';
  }
>;

/**
 * A Threat Dragon v2 file as the internal model, the document it was mapped
 * from, and the keys the wire schema did not declare. The document comes
 * back so the write codec can merge onto it, which is how the parts of the
 * file Panoptes does not model reach the output.
 *
 * Threat Dragon nests each threat under one cell, so a threat found under
 * several cells is one record here, attached to each of them and carrying
 * what its first appearance said. That is the inverse of the write, which
 * splits a threat across the cells it names.
 *
 * Four places the file and the model do not line up, and what the read
 * does about each. `lastIssuedThreatNumber` is the greater of the file's
 * `threatTop` and the highest number the file holds, because Threat Dragon
 * does not enforce the invariant the model does, and the Écluse file holds
 * threats numbered above its own mark. A trust boundary takes its name from
 * the label Threat Dragon draws on it where `data` holds none, which is
 * where the Écluse file keeps every boundary name. A contributor is an
 * object of one name, which flattens to the name. And a diagram is numbered
 * rather than named, so its number becomes its id.
 *
 * Everything the file leaves out takes the model's own default: an absent
 * name, description, or reason is the empty string, an absent `outOfScope`
 * is false, absent vertices are no waypoints, and an absent `threatTop` is
 * 0. Nothing is defaulted into the returned document, which keeps saying
 * what the file said.
 *
 * Nothing throws. Text that is not JSON is `MalformedText`, a document the
 * wire schema refuses is `InvalidWireDocument` with paths into the file,
 * and a mapping `parseModel` refuses, an unresolved flow endpoint or a
 * repeated threat number among them, is `InvalidModel` with paths into the
 * model.
 */
export function readThreatDragon(
  text: string,
): Either.Either<ReadResult<typeof threatDragonWireSchema>, ReadFailure> {
  return Either.flatMap(parseJson(text), mapDocument);
}

function parseJson(text: string): Either.Either<unknown, ReadFailure> {
  return Either.try({
    try: () => JSON.parse(text) as unknown,
    catch: (error) => ReadFailure.MalformedText({ message: String(error) }),
  });
}

function mapDocument(
  given: unknown,
): Either.Either<ReadResult<typeof threatDragonWireSchema>, ReadFailure> {
  const wire = threatDragonWireSchema.safeParse(given);
  if (!wire.success) {
    return Either.left(
      ReadFailure.InvalidWireDocument({
        issues: toParseIssues(wire.error.issues),
      }),
    );
  }
  return Either.mapBoth(parseModel(toModelInput(wire.data)), {
    onLeft: (failure) => ReadFailure.InvalidModel({ issues: failure.issues }),
    onRight: (model) => ({
      model,
      source: wire.data,
      divergences: undeclaredDivergences(given, wire.data),
    }),
  });
}

function toModelInput(document: ThreatDragonDocument) {
  const threats = toThreats(document.detail.diagrams);
  return {
    metadata: toMetadata(document),
    diagrams: document.detail.diagrams.map(toDiagram),
    threats,
    lastIssuedThreatNumber: toLastIssued(document, threats),
    mitigations: [],
    assumptions: [],
  };
}

function toMetadata(document: ThreatDragonDocument): MetadataInput {
  return {
    title: document.summary.title,
    owner: document.summary.owner ?? '',
    description: document.summary.description ?? '',
    contributors: (document.detail.contributors ?? []).map(
      (contributor) => contributor.name ?? '',
    ),
  };
}

function toDiagram(diagram: ThreatDragonDiagram): DiagramInput {
  return {
    id: String(diagram.id),
    title: diagram.title,
    elements: (diagram.cells ?? []).map(toElement),
  };
}

function toElement(cell: ThreatDragonCell): ElementInput {
  if (cell.shape === 'actor') {
    return { kind: 'actor', ...toNode(cell) };
  }
  if (cell.shape === 'process') {
    return { kind: 'process', ...toNode(cell) };
  }
  if (cell.shape === 'store') {
    return { kind: 'store', ...toNode(cell) };
  }
  if (cell.shape === 'flow') {
    return {
      kind: 'flow',
      ...toCommon(cell),
      source: toEndpoint(cell.source),
      target: toEndpoint(cell.target),
      waypoints: cell.vertices ?? [],
    };
  }
  if (cell.shape === 'trust-boundary-box') {
    return {
      kind: 'trust-boundary',
      ...toBoundaryCommon(cell),
      shape: { kind: 'box', position: cell.position, size: cell.size },
    };
  }
  return {
    kind: 'trust-boundary',
    ...toBoundaryCommon(cell),
    shape: {
      kind: 'curve',
      waypoints: [cell.source, ...(cell.vertices ?? []), cell.target],
    },
  };
}

function toNode(cell: NodeCell) {
  return { ...toCommon(cell), position: cell.position, size: cell.size };
}

function toCommon(cell: NodeCell | FlowCell) {
  return {
    id: cell.id,
    name: cell.data.name ?? '',
    description: cell.data.description ?? '',
    outOfScope: cell.data.outOfScope ?? false,
    reasonOutOfScope: cell.data.reasonOutOfScope ?? '',
  };
}

function toBoundaryCommon(cell: BoundaryCell) {
  return {
    id: cell.id,
    name: cell.data.name ?? cell.attrs?.label?.text ?? '',
    description: cell.data.description ?? '',
    outOfScope: false,
    reasonOutOfScope: '',
  };
}

function toEndpoint(endpoint: ThreatDragonEndpoint): EndpointInput {
  return isAnchored(endpoint)
    ? { kind: 'attached', element: endpoint.cell }
    : { kind: 'free', position: endpoint };
}

function isAnchored(
  endpoint: ThreatDragonEndpoint,
): endpoint is Extract<ThreatDragonEndpoint, { cell: string }> {
  return Object.hasOwn(endpoint, 'cell');
}

function toThreats(diagrams: readonly ThreatDragonDiagram[]): ThreatInput[] {
  const attached = new Map<
    string,
    { threat: ThreatDragonThreat; elements: string[] }
  >();
  for (const diagram of diagrams) {
    for (const cell of diagram.cells ?? []) {
      for (const threat of threatsOf(cell)) {
        const held = attached.get(threat.id);
        if (held) {
          held.elements.push(cell.id);
        } else {
          attached.set(threat.id, { threat, elements: [cell.id] });
        }
      }
    }
  }
  return [...attached.values()].map((entry) =>
    toThreat(entry.threat, entry.elements),
  );
}

function threatsOf(cell: ThreatDragonCell): readonly ThreatDragonThreat[] {
  return isBoundary(cell) ? [] : (cell.data.threats ?? []);
}

function isBoundary(cell: ThreatDragonCell): cell is BoundaryCell {
  return (
    cell.shape === 'trust-boundary-box' ||
    cell.shape === 'trust-boundary-curve' ||
    cell.shape === 'trust-broundary-curve'
  );
}

function toThreat(
  threat: ThreatDragonThreat,
  elements: readonly string[],
): ThreatInput {
  return {
    id: threat.id,
    number: threat.number,
    title: threat.title,
    category: toThreatCategory(threat),
    severity: toSeverity(threat.severity),
    status: toThreatStatus(threat.status),
    description: threat.description,
    mitigation: threat.mitigation,
    elements: [...elements],
  };
}

function toLastIssued(
  document: ThreatDragonDocument,
  threats: readonly ThreatInput[],
): number {
  return threats.reduce(
    (highest, threat) => Math.max(highest, threat.number),
    document.detail.threatTop ?? 0,
  );
}
