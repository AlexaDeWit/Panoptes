import { quotedForTerminal } from '@saerskriven/formats';
import {
  diagramsNamed,
  elementIdSchema,
  elementKindSchema,
  threatCountByElement,
  type Model,
} from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import {
  elementDetail,
  elementResultSchema,
  elementRow,
  elementsOnDiagrams,
  renderElement,
  type ElementOnDiagram,
} from './element-rows.js';
import {
  readNamed,
  readingSchema,
  renderReading,
  reportedReading,
  type ModelReading,
} from './reading.js';
import {
  limitedRows,
  matchesQuery,
  renderCounts,
  responseFormatSchema,
  searchArgumentsSchema,
  searchCountsSchema,
  type ResponseFormat,
} from './search.js';
import type { ModelWorkspace } from './workspace.js';

/** What `saer_search_elements` takes. */
export const searchElementsArgumentsSchema = searchArgumentsSchema.extend({
  element: elementIdSchema
    .optional()
    .describe(
      'Keep only this exact element id, including when other elements refer to it.',
    ),
  diagram: z
    .string()
    .optional()
    .describe(
      'Keep only elements of this diagram, named by its id or its exact title. Left out, every diagram of the model is searched.',
    ),
  kind: elementKindSchema
    .optional()
    .describe(
      'Keep only elements of this kind. `flow` is data in motion, `trust-boundary` a line across which trust changes, and `text` a note on the canvas that carries no threats.',
    ),
});

/** What `saer_search_elements` takes. */
export type SearchElementsArguments = z.infer<
  typeof searchElementsArgumentsSchema
>;

/** What `saer_search_elements` answers with. */
export const searchElementsResultSchema = readingSchema.extend({
  counts: searchCountsSchema,
  response_format: responseFormatSchema,
  elements: z.array(elementResultSchema),
});

/** What `saer_search_elements` answers with. */
export type SearchElementsResult = z.infer<typeof searchElementsResultSchema>;

/** What `saer_search_elements` tells a client it is for. */
export const searchElementsDescription = [
  'Find the elements of one Saerskriven threat model: the actors, processes, stores, data flows, trust boundaries and canvas notes its diagrams are drawn from. Each match carries the element id, the diagram it is drawn on, its kind, its name, and how many threats reference it.',
  'Use this to find the id of an element you mean to read threats about or attach a threat to, and to see which parts of a model carry no analysis. Use saer_coverage instead for the whole picture of what is analyzed and what is not, and saer_search_threats to search the threats rather than the elements they hang off.',
  'Pass `file` as a path relative to the server root, or leave it out where the server was started with a default model. `diagram` keeps one diagram, named by id or exact title. `kind` keeps one element kind. `query` searches without case through element ids, names, descriptions, note text, protocol, privilege level and declared relationship ids.',
  '`response_format` is `concise` by default. `detailed` carries the complete model element, including geometry, flow direction, optional security facts and declared boundary relationships. Missing optional fields mean not recorded, distinct from false, empty text and empty lists. Pass `element` for an exact id lookup.',
  'This tool never writes, and the counts it reports are of threats recorded rather than threats outstanding.',
].join(' ');

/**
 * The elements matching a search, or the lines saying why there are none to
 * search. The threat count is the model's own query, so an element no threat
 * references comes back with a count of 0 rather than being left out.
 */
export function searchElements(
  workspace: ModelWorkspace,
  args: SearchElementsArguments,
): Either.Either<SearchElementsResult, readonly string[]> {
  return Either.flatMap(readNamed(workspace, args.file), (reading) =>
    found(reading, args),
  );
}

/** The matching elements as the lines its text result carries. */
export function renderElementSearch(
  result: SearchElementsResult,
): readonly string[] {
  return [
    ...renderReading(result),
    ...renderCounts(result.counts, result.response_format, narrowing),
    'elements:',
    ...result.elements.flatMap(renderElement),
  ];
}

const narrowing = ['`element`', '`diagram`', '`kind`', '`query`'];

function found(
  reading: ModelReading,
  args: SearchElementsArguments,
): Either.Either<SearchElementsResult, readonly string[]> {
  return Either.map(
    searched(reading.model, args),
    (placed): SearchElementsResult => {
      const limited = limitedRows(placed, args.response_format);
      const counts = threatCountByElement(reading.model);
      return {
        ...reportedReading(reading),
        counts: limited.counts,
        response_format: args.response_format,
        elements: limited.rows.map((one) =>
          rowOf(one, counts.get(one.element.id) ?? 0, args.response_format),
        ),
      };
    },
  );
}

function searched(
  model: Model,
  args: SearchElementsArguments,
): Either.Either<readonly ElementOnDiagram[], readonly string[]> {
  return Either.map(diagramsOf(model, args.diagram), (diagrams) =>
    elementsOnDiagrams(diagrams).filter((placed) => keeps(placed, args)),
  );
}

function diagramsOf(
  model: Model,
  named: string | undefined,
): Either.Either<Model['diagrams'], readonly string[]> {
  if (named === undefined) {
    return Either.right(model.diagrams);
  }
  const selected = diagramsNamed(model.diagrams, named);
  return selected.length > 0
    ? Either.right(selected)
    : Either.left([
        `The model holds no diagram named ${quotedForTerminal(named)}.`,
        'Call saer_inspect for the id and the title of every diagram it holds.',
      ]);
}

function keeps(
  { element }: ElementOnDiagram,
  args: SearchElementsArguments,
): boolean {
  return (
    (args.element === undefined || element.id === args.element) &&
    (args.kind === undefined || element.kind === args.kind) &&
    matchesQuery(args.query, [
      element.id,
      element.name,
      element.description,
      element.kind === 'text' ? element.text : '',
      element.kind === 'process' ? (element.privilegeLevel ?? '') : '',
      element.kind === 'flow' ? (element.protocol ?? '') : '',
      ...(element.kind === 'flow' ? (element.trustBoundaryIds ?? []) : []),
      ...(element.kind === 'trust-boundary'
        ? [
            ...(element.containedElements ?? []),
            ...(element.crossingFlows ?? []),
          ]
        : []),
    ])
  );
}

function rowOf(
  placed: ElementOnDiagram,
  threats: number,
  format: ResponseFormat,
): z.infer<typeof elementResultSchema> {
  return format === 'detailed'
    ? elementDetail(placed, threats)
    : elementRow(placed, threats);
}
