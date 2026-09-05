/**
 * One colour of a palette, as a six-digit hex triple. One form throughout, so
 * {@link contrastRatio} has one string to read and a stylesheet one to emit.
 */
export type Colour = `#${string}`;

/**
 * The roles a palette assigns a colour to. A palette names roles rather than
 * shades, so the dark table answers the same questions as the light one and a
 * consumer never learns which table it was handed.
 */
export type Palette = {
  /** The studio shell, and the cream a badge lifts itself off the canvas with. */
  readonly surfaceApp: Colour;
  /** What a diagram is drawn on, and the halo a flow name is stroked in. */
  readonly surfaceCanvas: Colour;
  /** Panels, overlays, and the fill inside an element's outline. */
  readonly surfacePanel: Colour;
  /** The wash inside an actor. */
  readonly surfaceActor: Colour;
  /** The wash inside a process. */
  readonly surfaceProcess: Colour;
  /** Names, outlines and arrowheads: the pencil the diagram is drawn with. */
  readonly textPrimary: Colour;
  /** Notes, flow names, boundary dashes, and muted text in the chrome. */
  readonly textSecondary: Colour;
  /** Every hairline, the outline that identifies a control among them. */
  readonly border: Colour;
  /** The primary action, which is also the focus indicator. */
  readonly actionPrimary: Colour;
  /** The primary action under the pointer. */
  readonly actionHover: Colour;
  /** Text drawn on the primary action. */
  readonly actionText: Colour;
  /** The cream a threat badge is outlined and lettered in. */
  readonly badgeGround: Colour;
  /** Severity critical, a rust. */
  readonly toneCritical: Colour;
  /** Severity high, an ochre. */
  readonly toneHigh: Colour;
  /** Severity medium, a slate blue. */
  readonly toneMedium: Colour;
  /** Severity low, the olive of the primary action. */
  readonly toneLow: Colour;
  /** No severity assessed, a warm grey. */
  readonly toneNeutral: Colour;
};

/**
 * The light palette: the maintainer's vintage draftsman colours with the
 * lightness moved where the contrast floors demanded it and the hue left
 * alone. Four values are not the starting palette's own. The ochre is darker,
 * because cream lettering on the starting ochre measured 3.2 where a badge
 * needs 4.5. The secondary text and the hairline are darker, because they
 * measured 3.2 and 1.4 on the canvas ground where text needs 4.5 and a
 * control's outline 3. The fifth severity, which the starting palette does
 * not carry, is the olive of the primary action.
 */
export const lightPalette = {
  surfaceApp: '#FDFBF7',
  surfaceCanvas: '#F4EFE6',
  surfacePanel: '#FAF8F5',
  surfaceActor: '#EAEFF6',
  surfaceProcess: '#EFF3E8',
  textPrimary: '#3E3A35',
  textSecondary: '#706B62',
  border: '#96865E',
  actionPrimary: '#4A5D23',
  actionHover: '#3B4A1C',
  actionText: '#FDFBF7',
  badgeGround: '#FDFBF7',
  toneCritical: '#BA2D0B',
  toneHigh: '#A45611',
  toneMedium: '#3A6EA5',
  toneLow: '#4A5D23',
  toneNeutral: '#757069',
} as const satisfies Palette;

/**
 * The dark palette: the same hues over warm ink grounds, measured against the
 * same floors. Nothing applies it yet, so it is a table and not a theme.
 */
export const darkPalette = {
  surfaceApp: '#24211D',
  surfaceCanvas: '#1A1815',
  surfacePanel: '#2C2823',
  surfaceActor: '#202932',
  surfaceProcess: '#292E1F',
  textPrimary: '#E6E1D8',
  textSecondary: '#9A948B',
  border: '#807350',
  actionPrimary: '#769438',
  actionHover: '#8DB143',
  actionText: '#1A1815',
  badgeGround: '#1A1815',
  toneCritical: '#ED461D',
  toneHigh: '#C86914',
  toneMedium: '#4B86C3',
  toneLow: '#769438',
  toneNeutral: '#898275',
} as const satisfies Palette;

/**
 * The type the studio's chrome is set in. Every value is a CSS length or a
 * font stack, since the chrome is laid out by a browser.
 */
export const uiType = {
  family:
    "system-ui, -apple-system, 'Segoe UI', roboto, 'Helvetica Neue', arial, sans-serif",
  size: '0.875rem',
  lineHeight: '1.5',
} as const;

/**
 * The type a diagram is drawn in. Every size is user units rather than a CSS
 * length, because the wrap estimates its columns in the same units. The stack
 * asks for Arial last: Liberation Sans is metric-compatible with it and is
 * what the CLI typesets a PDF with, so a diagram keeps the layout the canvas
 * measured.
 */
export const canvasType = {
  family: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  elementName: 12,
  note: 12,
  flowName: 11,
  badgeCount: 11,
  secondaryBadgeCount: 9,
  badgeMark: 9,
} as const;

/** Every gap and every pad in the chrome, as four steps of a quarter rem. */
export const spacingScale = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
} as const;

/** Every corner in the chrome. */
export const radius = '4px';

/**
 * The one focus indicator. The width is separate from the ring so a control
 * drawing the ring in another colour, over the primary action say, still
 * draws it at the one width.
 */
export const focusRing = {
  width: '2px',
  offset: '2px',
} as const;

/**
 * The light tokens as the custom properties the studio's CSS modules read,
 * for injection once at the app root. It carries what those modules read and
 * nothing else: a diagram's own colours reach the drawing through
 * `canvasStylesheet`, which resolves them to values rather than to properties,
 * since the standalone SVG has no document around it to hold a `:root`.
 */
export const tokenStylesheet = `:root {
  --pn-font-family: ${uiType.family};
  --pn-font-size: ${uiType.size};
  --pn-line-height: ${uiType.lineHeight};

  --pn-colour-surface: ${lightPalette.surfaceApp};
  --pn-colour-surface-raised: ${lightPalette.surfacePanel};
  --pn-colour-canvas: ${lightPalette.surfaceCanvas};
  --pn-colour-text: ${lightPalette.textPrimary};
  --pn-colour-text-muted: ${lightPalette.textSecondary};
  --pn-colour-border: ${lightPalette.border};
  --pn-colour-accent: ${lightPalette.actionPrimary};
  --pn-colour-accent-text: ${lightPalette.actionText};

  --pn-space-1: ${spacingScale[1]};
  --pn-space-2: ${spacingScale[2]};
  --pn-space-3: ${spacingScale[3]};
  --pn-space-4: ${spacingScale[4]};

  --pn-radius: ${radius};

  --pn-focus-ring-width: ${focusRing.width};
  --pn-focus-ring: var(--pn-focus-ring-width) solid var(--pn-colour-accent);
  --pn-focus-ring-offset: ${focusRing.offset};
}
`;

const channels = (colour: Colour): readonly number[] =>
  [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16));

const linear = (channel: number): number => {
  const scaled = channel / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = (colour: Colour): number => {
  const [red, green, blue] = channels(colour).map(linear);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

/**
 * The contrast ratio of two colours, per WCAG 2.2: the lighter relative
 * luminance plus 0.05 over the darker plus 0.05, so between 1 and 21. WCAG
 * 2.2 AA asks 4.5 of text, and 3 of a mark or of the outline that identifies
 * a control.
 */
export function contrastRatio(one: Colour, other: Colour): number {
  const [first, second] = [relativeLuminance(one), relativeLuminance(other)];
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/**
 * How far apart two colours are over the sRGB channels. A coarse measure,
 * enough to catch two tones that have collapsed onto one shade. What tells
 * one severity from another is the badge's mark rather than this number, so
 * adjacent hues need only stay apart, not stay far apart.
 */
export function channelDistance(one: Colour, other: Colour): number {
  const [from, to] = [channels(one), channels(other)];
  return Math.hypot(from[0] - to[0], from[1] - to[1], from[2] - to[2]);
}
