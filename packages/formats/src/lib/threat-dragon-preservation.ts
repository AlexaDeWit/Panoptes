import { equivalent } from './equivalence.js';

/**
 * The text a merge writes where the source may already say it. Rewriting a
 * mapped field the source and the model agree on would record an edit
 * nobody made, so a value that still reads back the same is left in the
 * file's own wording, and a key the file never carried stays absent while
 * the model holds the empty string a read of that absence gives.
 */
export function preservedText(
  from: string | undefined,
  wanted: string,
): string | undefined {
  return (from ?? '') === wanted ? from : wanted;
}

/**
 * The flag a merge writes, on the terms {@link preservedText} sets, where an
 * absent key reads as false.
 */
export function preservedFlag(
  from: boolean | undefined,
  wanted: boolean,
): boolean | undefined {
  return (from ?? false) === wanted ? from : wanted;
}

/**
 * The list a merge writes, on the terms {@link preservedText} sets, where an
 * absent key reads as no entries.
 */
export function preservedList<Entry>(
  from: Entry[] | undefined,
  wanted: readonly Entry[],
): Entry[] | undefined {
  return equivalent(from ?? [], wanted) ? from : [...wanted];
}
