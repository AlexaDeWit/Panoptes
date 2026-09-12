import { quotedForTerminal } from '@saerskriven/formats';
import {
  diagramsNamed,
  elementKindSchema,
  threatCountByElement,
  type Model,
} from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import {
  elementDetail,
  elementDetailSchema,
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
  elements: z.array(elementDetailSchema),
});

/** What `saer_search_elements` answers with. */
export type SearchElementsResult = z.infer<typeof searchElementsResultSchema>;

/** What `saer_search_elements` tells a client it is for. */
export const searchElementsDescription = [
  'Find the elements of one Saerskriven threat model: the actors, processes, stores, data flows, trust boundaries and canvas notes its diagrams are drawn from. Each match carries the element id, the diagram it is drawn on, its kind, its name, and how many threats reference it.',
  'Use this to find the id of an element you mean to read threats about or attach a threat to, and to see which parts of a model carry no analysis. Use saer_coverage instead for the whole picture of what is analyzed and what is not, and saer_search_threats to search the threats rather than the elements they hang off.',
  'Pass `file` as a path relative to the server root, or leave it out where the server was started with a default model. `diagram` keeps one diagram, named by id or exact title. `kind` keeps one element kind. `query` is text looked for, without case, in the name, the description and the text of a note.',
  '`response_format` is `concise` by default. `detailed` adds the description, the scoping fields, and the geometry of each kind: the box of a node, the endpoints and waypoints of a flow, the shape of a trust boundary, and the text of a note.',
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
    ...renderCounts(result.counts, narrowing),
    'elements:',
    ...result.elements.flatMap(renderElement),
  ];
}

const narrowing = ['`diagram`', '`kind`', '`query`'];

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
    (args.kind === undefined || element.kind === args.kind) &&
    matchesQuery(args.query, [
      element.name,
      element.description,
      element.kind === 'text' ? element.text : '',
    ])
  );
}

function rowOf(
  placed: ElementOnDiagram,
  threats: number,
  format: ResponseFormat,
): z.infer<typeof elementDetailSchema> {
  return format === 'detailed'
    ? elementDetail(placed, threats)
    : elementRow(placed, threats);
}
