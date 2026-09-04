import {
  averageGlyphWidthRatio,
  innerWidth,
  lineHeight,
  lineHeightRatio,
  textExtent,
  textPadding,
  wrapText,
  xmlSafeText,
} from './typography.js';

const columnsFor = (columns: number): number =>
  columns * 10 * averageGlyphWidthRatio;

const graphemeClusters = [
  { name: 'a regional indicator flag', cluster: '\u{1F1E8}\u{1F1E6}' },
  {
    name: 'a subdivision flag spelled out in tag characters',
    cluster: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  },
  {
    name: 'a letter joined to a flag',
    cluster: 'a\u200D\u{1F1E8}\u{1F1E6}',
  },
  {
    name: 'a family joined by zero-width joiners',
    cluster: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}',
  },
  { name: 'a letter carrying one combining mark', cluster: 'e\u0301' },
  { name: 'a letter carrying two combining marks', cluster: 'e\u0327\u0301' },
  { name: 'an emoji carrying a variation selector', cluster: '\u2764\uFE0F' },
  {
    name: 'an emoji carrying a skin tone modifier',
    cluster: '\u{1F44D}\u{1F3FB}',
  },
];

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

  it('breaks a word of astral characters between them, never through one', () => {
    const padlock = '\u{1F510}';
    const word = padlock.repeat(6);
    const lines = wrapText(word, 10, columnsFor(4));
    expect(lines).toEqual([padlock.repeat(4), padlock.repeat(2)]);
    expect(lines.join('')).toBe(word);
  });

  it.each(graphemeClusters)(
    'keeps $name whole where the word is wider than the box',
    ({ cluster }) => {
      const word = cluster.repeat(6);
      const lines = wrapText(word, 10, columnsFor(4));
      expect(lines).toEqual([cluster.repeat(4), cluster.repeat(2)]);
      expect(lines.join('')).toBe(word);
    },
  );

  it('measures the joined line rather than adding up its parts', () => {
    expect(wrapText('a \u0301b', 10, columnsFor(3))).toEqual(['a \u0301b']);
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

  it.each(graphemeClusters)(
    'counts $name as one column, the width of a letter',
    ({ cluster }) => {
      expect(textExtent([cluster], 10)).toEqual(textExtent(['a'], 10));
    },
  );

  it('measures what the wrap produced, in the columns the wrap counted', () => {
    const flag = '\u{1F1E8}\u{1F1E6}';
    const lines = wrapText(
      `${flag.repeat(3)} ${flag.repeat(5)}`,
      10,
      columnsFor(5),
    );
    expect(lines).toEqual([flag.repeat(3), flag.repeat(5)]);
    expect(textExtent(lines, 10).width).toBe(columnsFor(5));
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

describe('xmlSafeText', () => {
  it('replaces every character XML 1.0 forbids, one for one', () => {
    for (const forbidden of [
      '\u0000',
      '\u0001',
      '\u0008',
      '\u000B',
      '\u000C',
      '\u000E',
      '\u001F',
      '\uD800',
      '\uDFFF',
      '\uFFFE',
      '\uFFFF',
    ]) {
      expect(xmlSafeText(`a${forbidden}b`)).toBe('a\uFFFDb');
    }
  });

  it('keeps the characters XML allows, astral planes included', () => {
    expect(xmlSafeText('a\tb\nc\rd')).toBe('a\tb\nc\rd');
    expect(xmlSafeText('\u{1F600} \u00E9 \uFFFD')).toBe(
      '\u{1F600} \u00E9 \uFFFD',
    );
  });

  it('reaches every run of text the canvas wraps', () => {
    expect(wrapText('a\u0000b', 10, columnsFor(40))).toEqual(['a\uFFFDb']);
  });
});
