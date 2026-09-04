import { z } from 'zod';

const acceptedClass =
  '\\p{L}\\p{M}\\p{N}\\p{P}\\p{S}\\p{Zs}\\t\\n\\r' +
  '[\\p{Cf}--[\\p{Script=Common}\\p{Script=Inherited}]]' +
  '\\u200C\\u200D\\u0605\\u06DD\\u08E2';

const refusedCharacter = new RegExp(`[^${acceptedClass}]`, 'v');

/**
 * Whether every character of `text` is one the model accepts. It leaves the
 * module for the schema report alone, which recognizes the rule by this
 * function and names it in words rather than printing its pattern at every
 * field that carries it.
 *
 * The rule is written as a search for one refused character rather than as
 * a match of the whole string: an anchored repetition over a text the size
 * `readLimits` admits exhausts the regex engine's backtracking stack, where
 * a search for a single character runs in one pass whatever the length. The
 * pattern is built with the constructor rather than written as a literal
 * because the set difference it uses needs the `v` flag, which the
 * TypeScript target this project compiles to does not accept on a literal.
 */
export function acceptsEveryCharacter(text: string): boolean {
  return !refusedCharacter.test(text);
}

/**
 * One string of the model, and the empty string is one: every letter, mark,
 * number, punctuation, symbol and space separator Unicode defines, plus tab,
 * line feed and carriage return, plus the format characters a script owns.
 * The rule is an allowlist because the opposite excludes a living script the
 * day Unicode adds one, and every string field of the model is this schema,
 * a branded id being this schema with a length.
 *
 * A format character is accepted when Unicode gives it a script of its own,
 * which is a rule rather than a list: the Arabic number signs and letter
 * mark, the Syriac abbreviation mark, the Mongolian vowel separator, the
 * Kaithi and Egyptian hieroglyph format controls, and whatever a later
 * Unicode adds beside them. Five that Unicode files as belonging to no
 * script are accepted by name: the zero width non-joiner U+200C and the zero
 * width joiner U+200D, which spell Persian, the Indic scripts and an emoji
 * sequence, and the Arabic number mark above U+0605, the end of ayah U+06DD
 * and the disputed end of ayah U+08E2, which Arabic writes.
 *
 * Saying nothing of the rest refuses it: the other control characters, which
 * no prose carries and which XML cannot hold; the other format characters no
 * script owns, among them the soft hyphen U+00AD, the bidirectional controls
 * U+200E, U+200F, U+202A to U+202E and U+2066 to U+2069 (the Arabic letter
 * mark U+061C is a bidirectional control too, and is accepted, Unicode
 * giving it the Arabic script), the zero width space U+200B, the word joiner
 * and the invisible operators U+2060 to U+206F, the byte order mark U+FEFF
 * and the tag characters, so a subdivision flag built from tags is refused
 * where every other emoji sequence is not; the line and paragraph separators
 * U+2028 and U+2029; private use; unassigned code points; and an unpaired
 * surrogate. Which
 * format characters the rule reaches is pinned beside its spec, in
 * `src/lib/text.format-characters.txt`, so a Unicode upgrade under the
 * runtime arrives as a diff rather than as a silent change.
 */
export const acceptedTextSchema = z
  .string()
  .refine(
    acceptsEveryCharacter,
    'Text carries a character the model does not accept.',
  );

/**
 * Where the first character {@link acceptedTextSchema} refuses sits, as an
 * index in UTF-16 code units, or undefined for text it accepts whole. An
 * editor has the parse issue's path to the field and this to the character
 * inside it.
 */
export function firstRefusedCharacter(text: string): number | undefined {
  const found = refusedCharacter.exec(text);
  return found === null ? undefined : found.index;
}
