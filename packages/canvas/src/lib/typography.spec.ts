import {
  averageGlyphWidthRatio,
  innerWidth,
  lineHeight,
  lineHeightRatio,
  textExtent,
  textPadding,
  wrapText,
} from './typography.js';

const columnsFor = (columns: number): number =>
  columns * 10 * averageGlyphWidthRatio;

describe('wrapText', () => {
  it('fits as many words on a line as the estimated width allows', () => {
    expect(wrapText('one two three four', 10, columnsFor(9))).toEqual([
      'one two',
      'three',
      'four',
    ]);
  });

  it('breaks a line where the text carries a newline', () => {
    expect(wrapText('first\nsecond', 10, columnsFor(40))).toEqual([
      'first',
      'second',
    ]);
  });

  it('keeps a blank line the text carries', () => {
    expect(wrapText('first\n\nsecond', 10, columnsFor(40))).toEqual([
      'first',
      '',
      'second',
    ]);
  });

  it('breaks a word wider than the whole line', () => {
    expect(wrapText('abcdefghij', 10, columnsFor(4))).toEqual([
      'abcd',
      'efgh',
      'ij',
    ]);
  });

  it('leaves no lines at all for empty text', () => {
    expect(wrapText('', 10, columnsFor(40))).toEqual([]);
  });

  it('leaves no lines at all for text holding only whitespace', () => {
    expect(wrapText('   ', 10, columnsFor(40))).toEqual([]);
    expect(wrapText('\n \n', 10, columnsFor(40))).toEqual([]);
  });

  it('keeps one character per line where the width fits nothing', () => {
    expect(wrapText('ab', 10, 0)).toEqual(['a', 'b']);
  });

  it('collapses the runs of whitespace between words', () => {
    expect(wrapText('one   two', 10, columnsFor(40))).toEqual(['one two']);
  });

  it('measures nothing: one text wraps the same at one size everywhere', () => {
    expect(wrapText('one two three', 10, columnsFor(9))).toEqual(
      wrapText('one two three', 10, columnsFor(9)),
    );
  });
});

describe('textExtent', () => {
  it('is as wide as the longest line and as tall as the block', () => {
    expect(textExtent(['ab', 'abcd'], 10)).toEqual({
      width: 4 * 10 * averageGlyphWidthRatio,
      height: lineHeight(10) + 10,
    });
  });

  it('takes up no room at all where there are no lines', () => {
    expect(textExtent([], 10)).toEqual({ width: 0, height: 0 });
  });

  it('measures what the wrap produced, by the ratio the wrap used', () => {
    const lines = wrapText('one two three', 10, columnsFor(5));
    expect(textExtent(lines, 10).width).toBe(
      Math.max(...lines.map((line) => line.length)) *
        10 *
        averageGlyphWidthRatio,
    );
  });
});

describe('innerWidth', () => {
  it('takes the padding off both sides of a box wide enough for it', () => {
    expect(innerWidth(100)).toBe(100 - textPadding * 2);
  });

  it('keeps a box too narrow for the padding at its own width', () => {
    expect(innerWidth(textPadding * 2)).toBe(textPadding * 2);
    expect(innerWidth(4)).toBe(4);
  });

  it('never hands wrapText a negative width', () => {
    expect(innerWidth(1)).toBeGreaterThan(0);
  });
});

describe('lineHeight', () => {
  it('scales the font size by the shared ratio', () => {
    expect(lineHeight(12)).toBe(12 * lineHeightRatio);
  });
});
