import {
  severitySchema,
  threatStatusSchema,
  type Threat,
} from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
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
import {
  renderThreat,
  threatDetail,
  threatDetailSchema,
  threatRow,
} from './threat-rows.js';
import type { ModelWorkspace } from './workspace.js';

/** What `saer_search_threats` takes. */
export const searchThreatsArgumentsSchema = searchArgumentsSchema.extend({
  status: threatStatusSchema
    .optional()
    .describe(
      'Keep only threats in this status. `open` is the threat nobody has dispositioned yet. Left out, threats in every status are matched.',
    ),
  severity: severitySchema
    .optional()
    .describe(
      'Keep only threats of this severity. `undecided` is a state of its own rather than a missing value, so it has to be asked for by name.',
    ),
  element: z
    .string()
    .optional()
    .describe(
      'Keep only threats that reference this element id. Find an id with saer_search_elements; an id no element carries matches nothing rather than being refused.',
    ),
});

/** What `saer_search_threats` takes. */
export type SearchThreatsArguments = z.infer<
  typeof searchThreatsArgumentsSchema
>;

/** What `saer_search_threats` answers with. */
export const searchThreatsResultSchema = readingSchema.extend({
  counts: searchCountsSchema,
  response_format: responseFormatSchema,
  threats: z.array(threatDetailSchema),
});

/** What `saer_search_threats` answers with. */
export type SearchThreatsResult = z.infer<typeof searchThreatsResultSchema>;

/** What `saer_search_threats` tells a client it is for. */
export const searchThreatsDescription = [
  'Find the threats recorded in one Saerskriven threat model. Each match carries the threat number and id, its title, where it stands, how bad it is, its category, and the ids of the elements it attaches to. The order is the register order the model holds them in.',
  'Use this to find the threats of one element, of one severity, or of one status, and to get the number of a threat you mean to read in full. Use saer_get_threat for one whole record with its mitigations and assumptions, and saer_coverage for what the model has not analyzed at all.',
  'Pass `file` as a path relative to the server root, or leave it out where the server was started with a default model. `status`, `severity` and `element` each keep only the threats matching them. `query` is text looked for, without case, in the title, the description and the mitigation prose.',
  '`response_format` is `concise` by default. `detailed` adds the description and the mitigation prose of each threat, which is the bulk of a register, so filter before asking for it.',
  'This tool never writes. A threat number names one threat for the life of a model, so a number read here stays the handle for that threat.',
].join(' ');

/**
 * The threats matching a search, or the lines saying why there are none to
 * search. Every filter is a conjunction, so a call naming a status and a
 * severity matches the threats carrying both.
 */
export function searchThreats(
  workspace: ModelWorkspace,
  args: SearchThreatsArguments,
): Either.Either<SearchThreatsResult, readonly string[]> {
  return Either.map(readNamed(workspace, args.file), (reading) =>
    found(reading, args),
  );
}

/** The matching threats as the lines its text result carries. */
export function renderThreatSearch(
  result: SearchThreatsResult,
): readonly string[] {
  return [
    ...renderReading(result),
    ...renderCounts(result.counts, narrowing),
    'threats:',
    ...result.threats.flatMap(renderThreat),
  ];
}

const narrowing = ['`status`', '`severity`', '`element`', '`query`'];

function found(
  reading: ModelReading,
  args: SearchThreatsArguments,
): SearchThreatsResult {
  const limited = limitedRows(
    reading.model.threats.filter((threat) => keeps(threat, args)),
    args.response_format,
  );
  return {
    ...reportedReading(reading),
    counts: limited.counts,
    response_format: args.response_format,
    threats: limited.rows.map((threat) => rowOf(threat, args.response_format)),
  };
}

function keeps(threat: Threat, args: SearchThreatsArguments): boolean {
  return (
    (args.status === undefined || threat.status === args.status) &&
    (args.severity === undefined || threat.severity === args.severity) &&
    (args.element === undefined ||
      threat.elements.some((element) => element === args.element)) &&
    matchesQuery(args.query, [
      threat.title,
      threat.description,
      threat.mitigation,
    ])
  );
}

function rowOf(threat: Threat, format: ResponseFormat) {
  return format === 'detailed' ? threatDetail(threat) : threatRow(threat);
}
