import { z } from 'zod';
import { fileArgumentSchema } from './inspect.js';

/**
 * How much of each match a search carries back. `concise` is the fields that
 * identify a record and let a caller choose the next call. `detailed` adds
 * the rest of the record, which costs a caller its context, so a search that
 * asks for it takes fewer matches before it is cut.
 */
export const responseFormatSchema = z.enum(['concise', 'detailed']);

/** How much of each match a search carries back. */
export type ResponseFormat = z.infer<typeof responseFormatSchema>;

/**
 * The arguments every search of this server takes, beside the `file` every
 * tool takes. Each search extends this with the filters of its own record.
 */
export const searchArgumentsSchema = fileArgumentSchema.extend({
  query: z
    .string()
    .optional()
    .describe(
      'Text to look for, compared without case as a substring of the fields listed in this tool description. Left out, every record the other filters keep is a match.',
    ),
  response_format: responseFormatSchema
    .default('concise')
    .describe(
      'How much of each match to return. `concise` is the identifying fields. `detailed` adds the whole record and carries fewer matches before the listing is cut, so narrow the search before asking for it.',
    ),
});

/** How many matches one result carries, per response format. */
export const searchLimits = { concise: 50, detailed: 20 } as const;

/** What a search matched, and how much of that the result carries. */
export const searchCountsSchema = z.object({
  matched: z.int().nonnegative(),
  returned: z.int().nonnegative(),
  truncated: z.boolean(),
});

/** What a search matched, and how much of that the result carries. */
export type SearchCounts = z.infer<typeof searchCountsSchema>;

/** The matches a result carries, cut to the limit for its response format. */
export type LimitedRows<Row> = {
  readonly rows: readonly Row[];
  readonly counts: SearchCounts;
};

/**
 * The matches cut to {@link searchLimits} for the response format asked for,
 * beside the count of everything that matched. A result carries the count
 * whether or not it was cut, so a caller can tell a listing of nine from the
 * first nine of ninety.
 */
export function limitedRows<Row>(
  matched: readonly Row[],
  format: ResponseFormat,
): LimitedRows<Row> {
  const rows = matched.slice(0, searchLimits[format]);
  return {
    rows,
    counts: {
      matched: matched.length,
      returned: rows.length,
      truncated: matched.length > rows.length,
    },
  };
}

/**
 * What a search matched, as the lines its text result states it in. A cut
 * listing says so and names the arguments that narrow this search, since a
 * caller reading the first twenty of two hundred as the whole answer is what
 * the line is against. The concise form is offered only to a detailed search,
 * which is the only one that has it left to ask for.
 */
export function renderCounts(
  counts: SearchCounts,
  format: ResponseFormat,
  narrowing: readonly string[],
): readonly string[] {
  return counts.truncated
    ? [
        `matches: ${String(counts.matched)}, of which this result carries ${String(counts.returned)}`,
        `The listing stopped at its limit, so it is not the whole answer. Narrow it with ${narrowing.join(', ')}${format === 'detailed' ? ', or ask for the concise form' : ''}.`,
      ]
    : [`matches: ${String(counts.matched)}`];
}

/**
 * Whether the query occurs in any of the texts, compared without case
 * through `toLowerCase`. An absent query matches every record, which is what
 * makes a search with no query the whole listing.
 */
export function matchesQuery(
  query: string | undefined,
  texts: readonly string[],
): boolean {
  if (query === undefined) {
    return true;
  }
  const wanted = query.toLowerCase();
  return texts.some((text) => text.toLowerCase().includes(wanted));
}
