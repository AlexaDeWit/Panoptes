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
import { Either } from 'effect';
import { parseDocument, YAMLParseError } from 'yaml';
import type { z } from 'zod';
import { ReadFailure, type ReadResult } from './codec.js';
import {
  aliasCostIn,
  type ComposedDocument,
} from './panoptes-yaml-document.js';
import {
  assumptionStatusesToModel,
  mitigationStatusesToModel,
  severitiesToModel,
  threatStatusesToModel,
  toModelCategory,
} from './panoptes-yaml-vocabulary.js';
import {
  exceededReadLimit,
  parseWithinLimits,
  readLimits,
} from './read-limits.js';
import { undeclaredDivergences } from './undeclared.js';

type MetadataInput = z.input<typeof modelMetadataSchema>;
type DiagramInput = z.input<typeof diagramSchema>;
type ElementInput = z.input<typeof elementSchema>;
type EndpointInput = z.input<typeof flowEndpointSchema>;
type BoundaryShapeInput = z.input<typeof boundaryShapeSchema>;
type ThreatInput = z.input<typeof threatSchema>;
type MitigationInput = z.input<typeof mitigationSchema>;
type AssumptionInput = z.input<typeof assumptionSchema>;

/**
 * A Panoptes YAML file as the internal model, the document it was mapped
 * from, and where the two do not correspond.
 *
 * The file and the model are separate declarations that say the same thing
 * today, so the mapping below is written out record by record rather than
 * handed across: the two are free to stop matching, and this is where that
 * would show. Ids reach the model as the plain strings the file holds and
 * are branded by `parseModel`, the same way the Threat Dragon read hands
 * them over. Vocabularies go through the tables in
 * `panoptes-yaml-vocabulary.ts`, which are total in both directions at
 * compile time. Geometry is a pair of numbers on either side and crosses
 * unchanged.
 *
 * `parseModel` is what enforces the cross-record rules no wire schema
 * states: ids unique where they must be, threat numbers unique and under
 * the mark, flow endpoints anchored inside their own diagram, and every
 * reference resolving.
 *
 * Nothing is defaulted and nothing is narrowed on the way through, so a
 * valid file reports no divergence at all. A key the wire schema does not
 * declare is reported as `undeclared`, which is the one entry a read of
 * this format can produce, and it means the file was written by a release
 * carrying something this one does not, since nothing else writes these
 * files.
 *
 * Threats arrive in the order the file lists them, which for a file
 * Panoptes wrote is number order. Reading reorders nothing.
 *
 * Nothing throws. A text past a bound in `readLimits` is
 * `ExceededReadLimit`. The read is in three steps rather than one call to
 * the parser, because the two alias bounds have to be taken between two of
 * them: the text is composed into a document, how many aliases resolving it
 * works through and how much of the document they repeat are measured
 * before any of them is resolved, and only then is the document turned into
 * a value. Resolving is where an alias costs anything, and
 * `panoptes-yaml-document.ts` carries what each measurement bounds.
 *
 * The parser's alias accounting is turned off rather than tuned, since it
 * costs more than what it bounds: `toJS` is given `maxAliasCount: -1`, and
 * both alias bounds are this package's own. A nesting the parser has no
 * stack for still arrives as a parse error coded `RESOURCE_EXHAUSTION`,
 * reported as the depth bound because it catches its composer's overflow
 * whole and reports nothing finer than that it ran out.
 *
 * Text that is not YAML is `MalformedText`. A document the wire schema
 * refuses, a missing or wrong `formatVersion` among them, is
 * `InvalidWireDocument` with paths into the file. A mapping `parseModel`
 * refuses is `InvalidModel` with paths into the model.
 */
export function readPanoptesYaml(
  text: string,
): Either.Either<ReadResult<typeof panoptesYamlWireSchema>, ReadFailure> {
  return Either.flatMap(parseYaml(text), mapDocument);
}

function parseYaml(text: string): Either.Either<unknown, ReadFailure> {
  return parseWithinLimits(text, (bounded) =>
    Either.flatMap(
      Either.flatMap(compose(bounded), withinAliasLimits),
      toValue,
    ),
  );
}

function compose(text: string): Either.Either<ComposedDocument, ReadFailure> {
  return Either.flatMap(
    Either.try({ try: () => parseDocument(text), catch: toReadFailure }),
    (document) => {
      const [refused] = document.errors;
      return refused === undefined
        ? Either.right(document)
        : Either.left(toReadFailure(refused));
    },
  );
}

function withinAliasLimits(
  document: ComposedDocument,
): Either.Either<ComposedDocument, ReadFailure> {
  const cost = aliasCostIn(document, {
    expanded: readLimits.maxAliasCount + 1,
    reached: readLimits.maxAliasExpansion + 1,
  });
  if (cost.expanded > readLimits.maxAliasCount) {
    return Either.left(exceededReadLimit('maxAliasCount', cost.expanded));
  }
  return cost.reached > readLimits.maxAliasExpansion
    ? Either.left(exceededReadLimit('maxAliasExpansion', cost.reached))
    : Either.right(document);
}

function toValue(
  document: ComposedDocument,
): Either.Either<unknown, ReadFailure> {
  return Either.try({
    try: () => document.toJS({ maxAliasCount: -1 }) as unknown,
    catch: toReadFailure,
  });
}

function toReadFailure(error: unknown): ReadFailure {
  if (error instanceof YAMLParseError && error.code === 'RESOURCE_EXHAUSTION') {
    return exceededReadLimit('maxNestingDepth', readLimits.maxNestingDepth + 1);
  }
  return ReadFailure.MalformedText({ message: String(error) });
}

function mapDocument(
  given: unknown,
): Either.Either<ReadResult<typeof panoptesYamlWireSchema>, ReadFailure> {
  const wire = panoptesYamlWireSchema.safeParse(given);
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

function toModelInput(document: PanoptesYamlDocument) {
  return {
    metadata: toMetadata(document.metadata),
    diagrams: document.diagrams.map(toDiagram),
    threats: document.threats.map(toThreat),
    lastIssuedThreatNumber: document.lastIssuedThreatNumber,
    mitigations: document.mitigations.map(toMitigation),
    assumptions: document.assumptions.map(toAssumption),
  };
}

function toMetadata(metadata: PanoptesYamlMetadata): MetadataInput {
  return {
    title: metadata.title,
    owner: metadata.owner,
    description: metadata.description,
    contributors: metadata.contributors,
  };
}

function toDiagram(diagram: PanoptesYamlDiagram): DiagramInput {
  return {
    id: diagram.id,
    title: diagram.title,
    elements: diagram.elements.map(toElement),
  };
}

function toElement(element: PanoptesYamlElement): ElementInput {
  if (element.kind === 'flow') {
    return {
      kind: 'flow',
      ...toCommon(element),
      source: toEndpoint(element.source),
      target: toEndpoint(element.target),
      waypoints: element.waypoints,
    };
  }
  if (element.kind === 'trust-boundary') {
    return {
      kind: 'trust-boundary',
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
  return {
    kind: element.kind,
    ...toCommon(element),
    position: element.position,
    size: element.size,
  };
}

function toCommon(element: PanoptesYamlElement) {
  return {
    id: element.id,
    name: element.name,
    description: element.description,
    outOfScope: element.outOfScope,
    reasonOutOfScope: element.reasonOutOfScope,
  };
}

function toEndpoint(endpoint: PanoptesYamlEndpoint): EndpointInput {
  return endpoint.kind === 'attached'
    ? { kind: 'attached', element: endpoint.element }
    : { kind: 'free', position: endpoint.position };
}

function toBoundaryShape(shape: PanoptesYamlBoundaryShape): BoundaryShapeInput {
  return shape.kind === 'box'
    ? { kind: 'box', position: shape.position, size: shape.size }
    : { kind: 'curve', waypoints: shape.waypoints };
}

function toThreat(threat: PanoptesYamlThreat): ThreatInput {
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

function toMitigation(mitigation: PanoptesYamlMitigation): MitigationInput {
  return {
    id: mitigation.id,
    title: mitigation.title,
    prose: mitigation.prose,
    status: mitigationStatusesToModel[mitigation.status],
    threats: mitigation.threats,
  };
}

function toAssumption(assumption: PanoptesYamlAssumption): AssumptionInput {
  return {
    id: assumption.id,
    prose: assumption.prose,
    status: assumptionStatusesToModel[assumption.status],
    elements: assumption.elements,
    threats: assumption.threats,
  };
}
