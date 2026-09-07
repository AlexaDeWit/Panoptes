import type { Severity } from '@saerskriven/model';
import {
  canvasType,
  lightPalette,
  paletteProperty,
  strokeWidths,
  type Palette,
} from './tokens.js';

/**
 * Every class name the primitives emit. A consumer names a class through
 * this map rather than by its string, so a rename is a compile error
 * wherever it is used and {@link canvasStylesheet} follows it.
 */
export const canvasClassNames = {
  element: 'pn-element',
  outOfScope: 'pn-out-of-scope',
  shape: 'pn-shape',
  actor: 'pn-actor',
  process: 'pn-process',
  store: 'pn-store',
  note: 'pn-note',
  boundaryBox: 'pn-boundary-box',
  boundaryCurve: 'pn-boundary-curve',
  label: 'pn-label',
  flow: 'pn-flow',
  flowArrow: 'pn-flow-arrow',
  flowLabel: 'pn-flow-label',
  badge: 'pn-badge',
  badgePrimary: 'pn-badge-primary',
  badgeSecondary: 'pn-badge-secondary',
  badgeCount: 'pn-badge-count',
  badgeMark: 'pn-badge-mark',
  toneCritical: 'pn-tone-critical',
  toneHigh: 'pn-tone-high',
  toneMedium: 'pn-tone-medium',
  toneLow: 'pn-tone-low',
  toneNeutral: 'pn-tone-neutral',
} as const;

/** One class name the primitives emit. */
export type CanvasClassName = keyof typeof canvasClassNames;

/** Which run of text a primitive is drawing. */
export type WrappedTextStyle = 'label' | 'note' | 'flowLabel';

/** How one run of text is named in the stylesheet and how large it is. */
export type TextStyleRule = {
  readonly className: string;
  readonly fontSize: number;
};

/**
 * The class name and font size of every run of wrapped text, in one table. A
 * primitive names a style rather than passing the two separately and the
 * stylesheet's own font sizes are read from here, so the size the wrap
 * estimates with is the size the text renders at by construction.
 */
export const wrappedTextStyles = {
  label: {
    className: canvasClassNames.label,
    fontSize: canvasType.widgetLabel,
  },
  note: { className: canvasClassNames.note, fontSize: canvasType.note },
  flowLabel: {
    className: canvasClassNames.flowLabel,
    fontSize: canvasType.widgetLabel,
  },
} as const satisfies Record<WrappedTextStyle, TextStyleRule>;

/**
 * The tone class each severity carries. `undecided` takes the neutral tone:
 * it is the absence of an assessment, so it never colours a badge.
 */
export const severityToneClass = {
  low: canvasClassNames.toneLow,
  medium: canvasClassNames.toneMedium,
  high: canvasClassNames.toneHigh,
  critical: canvasClassNames.toneCritical,
  undecided: canvasClassNames.toneNeutral,
} as const satisfies Record<Severity, string>;

/**
 * Stroke width a trust boundary is drawn with, the outline's own weight. The
 * layout grows a boundary curve's derived box by it, so the stroke falls
 * inside the node.
 */
export const boundaryStrokeWidth = strokeWidths.outline;

const name = canvasClassNames;

const text = wrappedTextStyles;

const type = canvasType;

const stroke = strokeWidths;

const sheetFrom = (
  colour: (role: keyof Palette) => string,
): string => `.${name.element} {
  font-family: ${type.family};
}
.${name.shape} {
  fill: ${colour('surfacePanel')};
  stroke: ${colour('textPrimary')};
  stroke-width: ${stroke.outline};
}
.${name.actor} {
  fill: ${colour('surfaceActor')};
}
.${name.process} {
  fill: ${colour('surfaceProcess')};
}
.${name.store} {
  fill: none;
  stroke-width: ${stroke.store};
}
.${name.boundaryBox},
.${name.boundaryCurve} {
  fill: none;
  stroke: ${colour('textSecondary')};
  stroke-width: ${boundaryStrokeWidth};
  stroke-dasharray: 8 6;
}
.${name.outOfScope} {
  opacity: 0.5;
}
.${name.outOfScope} .${name.shape} {
  stroke-dasharray: 6 4;
}
.${text.label.className} {
  fill: ${colour('textPrimary')};
  font-size: ${text.label.fontSize}px;
  font-weight: 500;
  text-anchor: middle;
  dominant-baseline: central;
}
.${text.note.className} {
  fill: ${colour('textSecondary')};
  font-size: ${text.note.fontSize}px;
  text-anchor: middle;
  dominant-baseline: central;
}
.${name.flow} {
  fill: none;
}
.${name.flowArrow} {
  fill: ${colour('textPrimary')};
  stroke: none;
}
.${text.flowLabel.className} {
  fill: ${colour('textSecondary')};
  font-size: ${text.flowLabel.fontSize}px;
  text-anchor: middle;
  dominant-baseline: central;
  paint-order: stroke;
  stroke: ${colour('surfaceCanvas')};
  stroke-width: ${stroke.labelHalo};
  stroke-linejoin: round;
}
.${name.badge} {
  stroke: ${colour('badgeGround')};
  stroke-width: ${stroke.badgeRing};
}
.${name.badgeCount} {
  fill: ${colour('badgeGround')};
  stroke: none;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: central;
}
.${name.badgePrimary} .${name.badgeCount} {
  font-size: ${type.badgeCount}px;
}
.${name.badgeSecondary} .${name.badgeCount} {
  font-size: ${type.secondaryBadgeCount}px;
}
.${name.badgeMark} {
  fill: ${colour('badgeGround')};
  stroke: none;
  font-size: ${type.badgeMark}px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
}
.${name.toneCritical} {
  fill: ${colour('toneCritical')};
}
.${name.toneHigh} {
  fill: ${colour('toneHigh')};
}
.${name.toneMedium} {
  fill: ${colour('toneMedium')};
}
.${name.toneLow} {
  fill: ${colour('toneLow')};
}
.${name.toneNeutral} {
  fill: ${colour('toneNeutral')};
}
`;

/**
 * The one stylesheet the primitives are drawn with, with every colour
 * resolved to a value. The headless renderer embeds it in a `<style>` element
 * inside the standalone SVG, and the PDF that embeds those bytes carries it
 * along: neither has a document around it to hold a `:root`, so neither can
 * read a custom property. Only properties SVG applies appear, so the sheet
 * works with no HTML around it, and interactive states join it as further
 * classes rather than as a second sheet.
 */
export const canvasStylesheet = sheetFrom((role) => lightPalette[role]);

/**
 * The same sheet with every colour left to the custom properties
 * `tokenStylesheet` declares on the document root, which is what the
 * studio injects: the diagram follows the colour scheme the root resolved,
 * where the standalone SVG keeps the light values.
 */
export const themedCanvasStylesheet = sheetFrom(paletteProperty);
