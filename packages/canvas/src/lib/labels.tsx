import type { Point } from '@panoptes/model';
import type { ReactElement } from 'react';
import { svgNumber } from './numbers.js';
import { wrappedTextStyles, type WrappedTextStyle } from './stylesheet.js';
import { lineHeight, wrapText } from './typography.js';

/**
 * Where `at` sits in the block of lines: at its centre, or at the centre of
 * its first line, which is what a label clearing a flow's own line needs.
 */
export type TextAnchor = 'centre' | 'top';

/**
 * Text wrapped to `width` and hung on `at`, as one `<text>` carrying a
 * `<tspan>` per line. The style names both the class the stylesheet gives
 * the run and the size the wrap estimates with, so the two cannot be paired
 * wrongly at a call site.
 */
export function WrappedText({
  text,
  at,
  anchor,
  width,
  textStyle,
}: {
  readonly text: string;
  readonly at: Point;
  readonly anchor: TextAnchor;
  readonly width: number;
  readonly textStyle: WrappedTextStyle;
}): ReactElement | null {
  const rule = wrappedTextStyles[textStyle];
  const lines = wrapText(text, rule.fontSize, width);
  if (lines.length === 0) {
    return null;
  }
  const step = lineHeight(rule.fontSize);
  const first =
    anchor === 'top' ? at.y : at.y - ((lines.length - 1) * step) / 2;
  return (
    <text className={rule.className} x={svgNumber(at.x)} y={svgNumber(first)}>
      {lines.map((line, index) => (
        <tspan
          key={index}
          x={svgNumber(at.x)}
          dy={svgNumber(index === 0 ? 0 : step)}
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}
