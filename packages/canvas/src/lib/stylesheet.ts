import type { Severity } from '@panoptes/model';

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
  label: { className: canvasClassNames.label, fontSize: 12 },
  note: { className: canvasClassNames.note, fontSize: 12 },
  flowLabel: { className: canvasClassNames.flowLabel, fontSize: 11 },
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
 * Stroke width a trust boundary is drawn with. The layout grows a boundary
 * curve's derived box by it, so the stroke falls inside the node.
 */
export const boundaryStrokeWidth = 2;

const name = canvasClassNames;

const text = wrappedTextStyles;

const badgeFontSize = 11;

const secondaryBadgeFontSize = 9;

const badgeMarkFontSize = 9;

const groundColour = '#ffffff';

/**
 * The one stylesheet the primitives are drawn with. The headless renderer
 * embeds it in a `<style>` element inside the standalone SVG and the studio
 * injects it once, so both draw one diagram. Only properties SVG applies
 * appear, so the sheet works with no HTML around it, and interactive states
 * join it as further classes rather than as a second sheet.
 */
export const canvasStylesheet = `.${name.element} {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}
.${name.shape} {
  fill: ${groundColour};
  stroke: #1f2937;
  stroke-width: 1.5;
}
.${name.actor} {
  fill: #eef2ff;
}
.${name.process} {
  fill: #f0fdf4;
}
.${name.store} {
  fill: none;
  stroke-width: 2;
}
.${name.boundaryBox},
.${name.boundaryCurve} {
  fill: none;
  stroke: #6b7280;
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
  fill: #111827;
  font-size: ${text.label.fontSize}px;
  font-weight: 500;
  text-anchor: middle;
  dominant-baseline: central;
}
.${text.note.className} {
  fill: #374151;
  font-size: ${text.note.fontSize}px;
  text-anchor: middle;
  dominant-baseline: central;
}
.${name.flow} {
  fill: none;
}
.${name.flowArrow} {
  fill: #1f2937;
  stroke: none;
}
.${text.flowLabel.className} {
  fill: #374151;
  font-size: ${text.flowLabel.fontSize}px;
  text-anchor: middle;
  dominant-baseline: central;
  paint-order: stroke;
  stroke: ${groundColour};
  stroke-width: 3;
  stroke-linejoin: round;
}
.${name.badge} {
  stroke: ${groundColour};
  stroke-width: 1.5;
}
.${name.badgeCount} {
  fill: ${groundColour};
  stroke: none;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: central;
}
.${name.badgePrimary} .${name.badgeCount} {
  font-size: ${badgeFontSize}px;
}
.${name.badgeSecondary} .${name.badgeCount} {
  font-size: ${secondaryBadgeFontSize}px;
}
.${name.badgeMark} {
  fill: ${groundColour};
  stroke: none;
  font-size: ${badgeMarkFontSize}px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
}
.${name.toneCritical} {
  fill: #7f1d1d;
}
.${name.toneHigh} {
  fill: #b91c1c;
}
.${name.toneMedium} {
  fill: #b45309;
}
.${name.toneLow} {
  fill: #1d4ed8;
}
.${name.toneNeutral} {
  fill: #52525b;
}
`;
