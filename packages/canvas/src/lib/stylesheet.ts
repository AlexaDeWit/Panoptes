import {
  badgeTextColour,
  defaultRenderTheme,
  type RenderTheme,
} from './render-theme.js';
import { severitySchema, type Severity } from '@saerskriven/model';
import {
  canvasType,
  lightPalette,
  paletteProperty,
  strokeWidths,
  type Palette,
} from './tokens.js';

/** Stable class names emitted by the canvas primitives. */
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

/** The stylesheet and text layout use the same font sizes. */
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

/** Maps each severity to its diagram tone class. */
export const severityToneClass = {
  low: canvasClassNames.toneLow,
  medium: canvasClassNames.toneMedium,
  high: canvasClassNames.toneHigh,
  critical: canvasClassNames.toneCritical,
  undecided: canvasClassNames.toneNeutral,
} as const satisfies Record<Severity, string>;

/** Shared stroke width for drawing and bounding a trust boundary. */
export const boundaryStrokeWidth = strokeWidths.outline;

const name = canvasClassNames;

const text = wrappedTextStyles;

const type = canvasType;

const stroke = strokeWidths;

const sheetFrom = (
  colour: (role: keyof Palette) => string,
  family: string = type.family,
): string => `.${name.element} {
  font-family: ${family};
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

/** The studio-independent canvas stylesheet with resolved light colours. */
export const canvasStylesheet = sheetFrom((role) => lightPalette[role]);

/** The studio canvas stylesheet resolves colours through its root properties. */
export const themedCanvasStylesheet = sheetFrom(paletteProperty);

/** Resolves headless drawing colours, font family, and badge appearance. */
export function renderCanvasStylesheet(
  theme: RenderTheme = defaultRenderTheme,
): string {
  const palette: Palette = {
    ...lightPalette,
    surfaceCanvas: theme.colours.background,
    surfacePanel: theme.colours.element,
    surfaceActor: theme.colours.actor,
    surfaceProcess: theme.colours.process,
    textPrimary: theme.colours.text,
    textSecondary: theme.colours.muted,
    badgeGround: badgeTextColour(theme, theme.colours.text),
    toneCritical: theme.severity.critical,
    toneHigh: theme.severity.high,
    toneMedium: theme.severity.medium,
    toneLow: theme.severity.low,
    toneNeutral: theme.severity.undecided,
  };
  const badges = severitySchema.options.map((severity) => {
    const className = severityToneClass[severity];
    const tone = theme.severity[severity];
    const outlined = theme.badges.style === 'outline';
    return `.${className} { fill: ${outlined ? theme.colours.background : tone}; stroke: ${tone}; stroke-width: ${String(theme.badges.borderWidth)}; }
.${className} ~ .${name.badgeCount}, .${className} ~ .${name.badgeMark} { fill: ${badgeTextColour(theme, tone)}; }`;
  });
  return [
    sheetFrom((role) => palette[role], JSON.stringify(theme.fonts.body)),
    ...badges,
  ].join('\n');
}
