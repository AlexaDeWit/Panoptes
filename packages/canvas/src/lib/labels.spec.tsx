import { renderToStaticMarkup } from 'react-dom/server';
import { WrappedText, type TextAnchor } from './labels.js';
import { wrappedTextStyles } from './stylesheet.js';
import { lineHeight } from './typography.js';

const step = lineHeight(wrappedTextStyles.label.fontSize);

const markupOf = (
  text: string,
  width: number,
  anchor: TextAnchor = 'centre',
): string =>
  renderToStaticMarkup(
    <WrappedText
      text={text}
      at={{ x: 100, y: 50 }}
      anchor={anchor}
      width={width}
      textStyle="label"
    />,
  );

describe('WrappedText', () => {
  it('draws one tspan per wrapped line', () => {
    expect(markupOf('one two three', 36).match(/<tspan/gu)).toHaveLength(3);
  });

  it('steps each line down by one line height', () => {
    expect(markupOf('one two', 36)).toContain(`dy="${step}"`);
  });

  it('starts the first line at no offset of its own', () => {
    expect(markupOf('one', 400)).toContain('dy="0"');
  });

  it('centres the block of lines on the given point', () => {
    expect(markupOf('one two', 36)).toContain(`y="${50 - step / 2}"`);
  });

  it('hangs the first line from the given point when anchored to the top', () => {
    expect(markupOf('one two', 36, 'top')).toContain('y="50"');
  });

  it('takes the class and the font size from one style, never a pair', () => {
    expect(markupOf('one', 400)).toContain(
      `class="${wrappedTextStyles.label.className}"`,
    );
  });

  it('draws nothing at all for empty text', () => {
    expect(markupOf('', 400)).toBe('');
  });
});
