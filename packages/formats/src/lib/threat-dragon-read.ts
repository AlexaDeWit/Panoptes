import {
  diagramSchema,
  elementSchema,
  flowEndpointSchema,
  modelMetadataSchema,
  parseModel,
  threatSchema,
  toParseIssues,
  type Model,
  type ThreatCategory,
} from '@panoptes/model';
import {
  threatDragonWireSchema,
  type ThreatDragonCell,
  type ThreatDragonDiagram,
  type ThreatDragonDocument,
  type ThreatDragonEndpoint,
  type ThreatDragonThreat,
} from '@panoptes/wire-threat-dragon';
import { Either } from 'effect';
import type { z } from 'zod';
import { ReadFailure, type ReadResult } from './codec.js';
import type { Divergence } from './divergence.js';
import {
  cellsOf,
  isAnchored,
  threatsOf,
  type ThreatDragonBoundary,
  type ThreatDragonCurve,
  type ThreatDragonFlow,
  type ThreatDragonNode,
} from './threat-dragon-document.js';
import {
  toSeverity,
  toThreatCategory,
  toThreatStatus,
} from './threat-dragon-vocabulary.js';
import { undeclaredDivergences } from './undeclared.js';

type MetadataInput = z.input<typeof modelMetadataSchema>;
type DiagramInput = z.input<typeof diagramSchema>;
type ElementInput = z.input<typeof elementSchema>;
type EndpointInput = z.input<typeof flowEndpointSchema>;
type ThreatInput = z.input<typeof threatSchema>;

type ThreatEntry = {
  readonly threat: ThreatDragonThreat;
  readonly elements: readonly string[];
  readonly number: number;
};

/**
 * A Threat Dragon v2 file as the internal model, the document it was mapped
 * from, and where the two do not correspond. The document comes back so the
 * write codec can merge onto it, which is how the parts of the file
 * Panoptes does not model reach the output.
 *
 * Threat Dragon nests each threat under one cell, so a threat found under
 * several cells is one record here, attached to each of them and carrying
 * what its first appearance said. That is the inverse of the write, which
 * splits a threat across the cells it names.
 *
 * Five places the file and the model do not line up, and what the read does
 * about each. `lastIssuedThreatNumber` is the greater of the file's
 * `threatTop` and the highest number the file holds, because Threat Dragon
 * does not enforce the invariant the model does, and the Écluse file holds
 * threats numbered above its own mark. A threat with no number at all, and
 * most threats in Threat Dragon's own demo models have none, is issued the
 * next number above that mark, so no number is reused. A trust boundary
 * takes its name from the label Threat Dragon draws on it where `data`
 * holds none, which is where the Écluse file keeps every boundary name. A
 * contributor is an object of one name, which flattens to the name. And a
 * diagram is numbered rather than named, so its number becomes its id.
 *
 * Everything the file leaves out takes the model's own default: an absent
 * name, description, or reason is the empty string, an absent `outOfScope`
 * is false, absent vertices are no waypoints, and an absent `threatTop` is
 * 0. Nothing is defaulted into the returned document, which keeps saying
 * what the file said.
 *
 * The divergences are the keys the wire schema did not declare, plus one
 * `narrowed` entry per threat value the model holds less exactly than the
 * file stated it: a status or severity from no vocabulary this codec knows,
 * a category label from no language Threat Dragon ships, and an Elevation
 * of Privilege card, of which only the suit has a home.
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
  const mapping = toMapping(wire.data);
  return Either.mapBoth(parseModel(mapping.input), {
    onLeft: (failure) => ReadFailure.InvalidModel({ issues: failure.issues }),
    onRight: (model) => ({
      model,
      source: wire.data,
      divergences: [
        ...undeclaredDivergences(given, wire.data),
        ...narrowings(model, mapping.notes),
      ],
    }),
  });
}

function toMapping(document: ThreatDragonDocument) {
  const { entries, lastIssued } = toThreatEntries(document);
  const threats = entries.map(toThreat);
  return {
    input: {
      metadata: toMetadata(document),
      diagrams: document.detail.diagrams.map(toDiagram),
      threats: threats.map((threat) => threat.record),
      lastIssuedThreatNumber: lastIssued,
      mitigations: [],
      assumptions: [],
    },
    notes: new Map(
      threats
        .filter((threat) => threat.notes.length > 0)
        .map((threat) => [threat.record.id, threat.notes]),
    ),
  };
}

function narrowings(
  model: Model,
  notes: ReadonlyMap<string, readonly string[]>,
): Divergence[] {
  return model.threats.flatMap((threat) =>
    (notes.get(threat.id) ?? []).map((detail): Divergence => ({
      subject: { kind: 'threat', id: threat.id },
      detail,
      reason: 'narrowed',
    })),
  );
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
    elements: cellsOf(diagram).map(toElement),
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
  if (cell.shape === 'td-text-block') {
    return {
      kind: 'text',
      id: cell.id,
      name: '',
      description: cell.data.description ?? '',
      outOfScope: false,
      reasonOutOfScope: '',
      position: cell.position,
      size: cell.size,
      text: cell.data.name ?? cell.attrs?.text?.text ?? '',
    };
  }
  if (cell.shape === 'trust-boundary-box') {
    return {
      kind: 'trust-boundary',
      ...toBoundaryCommon(cell),
      shape: { kind: 'box', position: cell.position, size: cell.size },
    };
  }
  return toCurveBoundary(cell);
}

function toCurveBoundary(cell: ThreatDragonCurve): ElementInput {
  return {
    kind: 'trust-boundary',
    ...toBoundaryCommon(cell),
    shape: {
      kind: 'curve',
      waypoints: [cell.source, ...(cell.vertices ?? []), cell.target],
    },
  };
}

function toNode(cell: ThreatDragonNode) {
  return { ...toCommon(cell), position: cell.position, size: cell.size };
}

function toCommon(cell: ThreatDragonNode | ThreatDragonFlow) {
  return {
    id: cell.id,
    name: cell.data.name ?? '',
    description: cell.data.description ?? '',
    outOfScope: cell.data.outOfScope ?? false,
    reasonOutOfScope: cell.data.reasonOutOfScope ?? '',
  };
}

function toBoundaryCommon(cell: ThreatDragonBoundary) {
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

function toThreatEntries(document: ThreatDragonDocument): {
  entries: ThreatEntry[];
  lastIssued: number;
} {
  const grouped = groupThreats(document.detail.diagrams);
  let issued = grouped.reduce(
    (highest, group) => Math.max(highest, group.threat.number ?? 0),
    document.detail.threatTop ?? 0,
  );
  const entries: ThreatEntry[] = [];
  for (const group of grouped) {
    if (group.threat.number === undefined) {
      issued += 1;
    }
    entries.push({ ...group, number: group.threat.number ?? issued });
  }
  return { entries, lastIssued: issued };
}

function groupThreats(
  diagrams: readonly ThreatDragonDiagram[],
): { threat: ThreatDragonThreat; elements: string[] }[] {
  const attached = new Map<
    string,
    { threat: ThreatDragonThreat; elements: string[] }
  >();
  for (const diagram of diagrams) {
    for (const cell of cellsOf(diagram)) {
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
  return [...attached.values()];
}

function toThreat(entry: ThreatEntry): {
  record: ThreatInput;
  notes: string[];
} {
  const { threat } = entry;
  const status = toThreatStatus(threat.status);
  const severity = toSeverity(threat.severity);
  const category = toThreatCategory(threat);
  return {
    record: {
      id: threat.id,
      number: entry.number,
      title: threat.title,
      category: category.value,
      severity: severity.value,
      status: status.value,
      description: threat.description,
      mitigation: threat.mitigation,
      elements: [...entry.elements],
    },
    notes: [
      ...(status.exact
        ? []
        : [`the status "${threat.status}", which the model has no state for`]),
      ...(severity.exact
        ? []
        : [
            `the severity "${threat.severity}", which the model has no level for`,
          ]),
      ...(category.exact ? [] : [categoryNote(threat, category.value)]),
    ],
  };
}

function categoryNote(
  threat: ThreatDragonThreat,
  category: ThreatCategory,
): string {
  return threat.modelType === 'EOP'
    ? 'the Elevation of Privilege card, of which the model holds the suit alone'
    : `the category "${category.category}", which no language of Threat Dragon's names`;
}
