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
 * the wrap laid it out. The height runs from the top of the first line to
 * the bottom of the last.
 */
export function textExtent(
  lines: readonly string[],
  fontSize: number,
): TextExtent {
  if (lines.length === 0) {
    return { width: 0, height: 0 };
  }
  const columns = Math.max(...lines.map((line) => line.length));
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
 * The given text broken into the lines that fit `maxWidth` at `fontSize`, by
 * {@link averageGlyphWidthRatio} rather than by measurement. A newline breaks
 * a line where it stands, a word wider than the width is broken across lines,
 * and text holding nothing but whitespace yields no lines at all.
 */
export function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
): string[] {
  if (text.trim() === '') {
    return [];
  }
  const columns = Math.max(
    1,
    Math.floor(maxWidth / (fontSize * averageGlyphWidthRatio)),
  );
  return text
    .split('\n')
    .flatMap((paragraph) => wrapParagraph(paragraph, columns));
}

function wrapParagraph(paragraph: string, columns: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const chunk of chunksOf(paragraph, columns)) {
    if (line === '') {
      line = chunk;
    } else if (line.length + 1 + chunk.length <= columns) {
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
  const pieces: string[] = [];
  for (let at = 0; at < word.length; at += columns) {
    pieces.push(word.slice(at, at + columns));
  }
  return pieces;
}
