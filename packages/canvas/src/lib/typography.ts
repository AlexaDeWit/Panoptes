/**
 * Advance width of one character as a fraction of the font size. Wrapping
 * never measures a glyph: the headless render has no layout engine and has
 * to agree with the interactive canvas byte for byte, so every line is
 * estimated from this one ratio.
 */
export const averageGlyphWidthRatio = 0.55;

/** Baseline-to-baseline distance as a fraction of the font size. */
export const lineHeightRatio = 1.25;

/** Distance kept between an element's outline and the text inside it. */
export const textPadding = 6;

/**
 * Width a name wraps to where the element's own box is the wrong one to take
 * it from: a flow, which has no box at all, and a boundary curve, whose box
 * is the span of its waypoints rather than a frame a name sits inside.
 */
export const looseLabelWidth = 140;

/** Distance a flow's name and its badge keep clear of the flow's own line. */
export const flowLabelClearance = 14;

/** The box a run of lines occupies, in canvas units. */
export type TextExtent = {
  readonly width: number;
  readonly height: number;
};

/** Baseline-to-baseline distance at the given font size. */
export function lineHeight(fontSize: number): number {
  return fontSize * lineHeightRatio;
}

/**
 * The box the given lines occupy, estimated with the same ratio the wrap
 * used, so a caller placing a block clear of something measures it the way
 * the wrap laid it out. A column is one grapheme cluster, as it is in
 * {@link wrapText}, so a flag counts as wide as a letter. The height runs
 * from the top of the first line to the bottom of the last.
 */
export function textExtent(
  lines: readonly string[],
  fontSize: number,
): TextExtent {
  if (lines.length === 0) {
    return { width: 0, height: 0 };
  }
  const columns = Math.max(...lines.map((line) => columnsOf(line)));
  return {
    width: columns * fontSize * averageGlyphWidthRatio,
    height: (lines.length - 1) * lineHeight(fontSize) + fontSize,
  };
}

/**
 * The width text has inside a box: the box less the padding on both sides,
 * or the whole box where it is too narrow to hold the padding, so a width
 * reaching {@link wrapText} is never negative.
 */
export function innerWidth(boxWidth: number): number {
  const padded = boxWidth - textPadding * 2;
  return padded > 0 ? padded : boxWidth;
}

/**
 * The given text with every character XML 1.0 forbids replaced by U+FFFD:
 * the C0 controls other than tab, newline and carriage return, an unpaired
 * surrogate, U+FFFE and U+FFFF. A name, a title, and a note are free text
 * the model takes as it finds it, so a file written elsewhere can carry one
 * of these into a diagram, and an SVG document holding one is refused whole
 * by every XML parser rather than drawn with a gap. Replacing rather than
 * dropping keeps the character count, so a wrap estimated on the result is
 * the wrap of what is drawn. Every run of text this package draws goes
 * through {@link wrapText}, which calls this; a document composed around
 * those glyphs applies it to its own text as well.
 */
export function xmlSafeText(text: string): string {
  let safe = '';
  for (const character of text) {
    safe += allowedInXml(character) ? character : '\uFFFD';
  }
  return safe;
}

function allowedInXml(character: string): boolean {
  const code = character.charCodeAt(0);
  const control =
    code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;
  const loneSurrogate =
    character.length === 1 && code >= 0xd800 && code <= 0xdfff;
  const nonCharacter = code === 0xfffe || code === 0xffff;
  return !control && !loneSurrogate && !nonCharacter;
}

/**
 * The given text broken into the lines that fit `maxWidth` at `fontSize`, by
 * {@link averageGlyphWidthRatio} rather than by measurement. A newline breaks
 * a line where it stands, a word wider than the width is broken across lines,
 * and text holding nothing but whitespace yields no lines at all. What comes
 * back is {@link xmlSafeText} of the input, so no line carries a character
 * the document it lands in cannot hold.
 *
 * A column is one grapheme cluster, so a break falls between clusters: a
 * regional-indicator flag stays one flag rather than two letters, a family
 * joined by zero-width joiners stays one family, and half a surrogate pair
 * never lands on a line of its own, which is the document refused whole that
 * {@link xmlSafeText} exists to prevent, arrived at after it has run.
 *
 * A cluster is settled by an explicit rule over code points rather than by
 * `Intl.Segmenter`, whose segmentation data moves with the runtime's ICU and
 * would move a golden on a node bump. A code point joins the one before it
 * where it is a combining mark, a variation selector, an emoji skin tone
 * modifier, a zero-width joiner, or the code point after a zero-width
 * joiner, and a pair of regional indicators is one cluster. What it reads is
 * general category and the regional indicator property, not a segmentation
 * table. What it does not cover, and so still breaks, is a Hangul jamo
 * sequence, a prepended concatenation mark such as U+0600, and an Indic
 * conjunct joined through a virama.
 */
export function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
): string[] {
  const drawable = xmlSafeText(text);
  if (drawable.trim() === '') {
    return [];
  }
  const columns = Math.max(
    1,
    Math.floor(maxWidth / (fontSize * averageGlyphWidthRatio)),
  );
  return drawable
    .split('\n')
    .flatMap((paragraph) => wrapParagraph(paragraph, columns));
}

function wrapParagraph(paragraph: string, columns: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const chunk of chunksOf(paragraph, columns)) {
    if (line === '') {
      line = chunk;
    } else if (columnsOf(line) + 1 + columnsOf(chunk) <= columns) {
      line = `${line} ${chunk}`;
    } else {
      lines.push(line);
      line = chunk;
    }
  }
  lines.push(line);
  return lines;
}

function chunksOf(paragraph: string, columns: number): string[] {
  return paragraph
    .split(/\s+/u)
    .filter((word) => word !== '')
    .flatMap((word) => brokenWord(word, columns));
}

function brokenWord(word: string, columns: number): string[] {
  const clusters = clustersOf(word);
  const pieces: string[] = [];
  for (let at = 0; at < clusters.length; at += columns) {
    pieces.push(clusters.slice(at, at + columns).join(''));
  }
  return pieces;
}

function columnsOf(text: string): number {
  return clustersOf(text).length;
}

const anyCodePoint = '[\\s\\S]';
const flagPair = '\\p{Regional_Indicator}{2}';
const attachedToPrevious = '[\\p{M}\\uFE0E\\uFE0F\\u{1F3FB}-\\u{1F3FF}]*';
const joinedToPrevious = `\\u200D${anyCodePoint}${attachedToPrevious}`;
const graphemeCluster = new RegExp(
  `(?:${flagPair}|${anyCodePoint})${attachedToPrevious}(?:${joinedToPrevious})*`,
  'gu',
);

function clustersOf(text: string): string[] {
  return Array.from(text.matchAll(graphemeCluster), (match) => match[0]);
}
