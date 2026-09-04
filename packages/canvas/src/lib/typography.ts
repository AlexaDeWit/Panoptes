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
 * the wrap laid it out. A column is one code point, as it is in the wrap.
 * The height runs from the top of the first line to the bottom of the last.
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
 * A column is one code point rather than one UTF-16 unit, so a break falls
 * between characters and never through a surrogate pair: half a pair on each
 * of two lines is two lone surrogates, which is the document refused whole
 * that {@link xmlSafeText} exists to prevent, arrived at after it has run.
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
  const characters = Array.from(word);
  const pieces: string[] = [];
  for (let at = 0; at < characters.length; at += columns) {
    pieces.push(characters.slice(at, at + columns).join(''));
  }
  return pieces;
}

function columnsOf(text: string): number {
  return Array.from(text).length;
}
