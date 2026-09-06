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
  /**
   * The ruled lines of the graph paper the studio draws a diagram on. It is
   * lighter than the hairline on purpose: nothing is read off the grid, so it
   * sits below the ratio a mark needs rather than at it.
   */
  readonly gridLine: Colour;
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
 * alone. Six values are not the starting palette's own. The ochre and the
 * warm grey are darker, because cream lettering on them measured 3.2 and 4.4
 * where a badge needs 4.5. The secondary text and the hairline are darker,
 * because they measured 3.2 and 1.4 on the canvas ground where text needs 4.5
 * and a control's outline 3. The last two are roles the starting palette has
 * none of: the fifth severity, which is the olive of the primary action, and
 * the grid line, a warm taupe at a graph-paper weight over the canvas ground.
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
  gridLine: '#D2C8B3',
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
 * same floors, its hairline lightened a step past the first table so it clears
 * 3 on the wash a process is filled with. The studio takes it under the
 * system's dark preference. The headless render stays on the light table.
 */
export const darkPalette = {
  surfaceApp: '#24211D',
  surfaceCanvas: '#1A1815',
  surfacePanel: '#2C2823',
  surfaceActor: '#202932',
  surfaceProcess: '#292E1F',
  textPrimary: '#E6E1D8',
  textSecondary: '#9A948B',
  border: '#847753',
  gridLine: '#38342D',
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

/**
 * Every stroke the drawing lays down, in user units rather than CSS lengths,
 * since a diagram is measured in the model's own coordinates. One weight
 * carries an element's outline, a trust boundary's dashes and a flow's line,
 * so a diagram reads as drawn by one hand. A store is heavier because its two
 * lines are the whole glyph and have no box to sit in. The badge ring and the
 * halo under a flow name are laid down in a ground colour rather than in ink:
 * they cut the mark out of whatever it is drawn over.
 */
export const strokeWidths = {
  outline: 2,
  store: 2.5,
  badgeRing: 3,
  labelHalo: 3,
} as const;

/**
 * The triangle that marks where a flow ends, in user units: how far its base
 * sits back from the tip, and how far each wing reaches from the line. It is
 * sized to be read at the zoom a diagram opens at rather than off the line it
 * ends, which is two units wide and would leave a mark to look for.
 */
export const arrowhead = {
  length: 18,
  halfWidth: 7,
} as const;

/**
 * How far a threat badge reaches from its own centre, in user units. The ring
 * in {@link strokeWidths} is centred on the circle, so half of it eats into
 * the disc the count is lettered on, and each radius carries the room the
 * count needs inside what the ring leaves.
 */
export const badgeRadius = {
  primary: 13,
  secondary: 9,
} as const;

/**
 * The gap between the ruled lines of the graph paper the studio draws a
 * diagram on, in user units, so the grid scales with the viewport. The
 * headless render lays down no grid: it writes the diagram rather than the
 * surface it was drawn on.
 */
export const gridSpacing = 25;

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

const colourProperties = {
  surfaceApp: '--pn-colour-surface',
  surfaceCanvas: '--pn-colour-canvas',
  surfacePanel: '--pn-colour-surface-raised',
  surfaceActor: '--pn-colour-actor',
  surfaceProcess: '--pn-colour-process',
  textPrimary: '--pn-colour-text',
  textSecondary: '--pn-colour-text-muted',
  border: '--pn-colour-border',
  gridLine: '--pn-colour-grid',
  actionPrimary: '--pn-colour-accent',
  actionHover: '--pn-colour-accent-hover',
  actionText: '--pn-colour-accent-text',
  badgeGround: '--pn-colour-badge-ground',
  toneCritical: '--pn-colour-tone-critical',
  toneHigh: '--pn-colour-tone-high',
  toneMedium: '--pn-colour-tone-medium',
  toneLow: '--pn-colour-tone-low',
  toneNeutral: '--pn-colour-tone-neutral',
} as const satisfies Record<keyof Palette, string>;

/**
 * How a stylesheet inside a document names one colour role: the custom
 * property carrying it rather than a value, so the rule draws with whichever
 * table the document root resolved. The names have one home, the table this
 * reads, which the two `:root` blocks below are written from as well, and
 * that table is total over the roles, so a role added to {@link Palette} does
 * not compile until it has been named a property.
 */
export function paletteProperty(role: keyof Palette): string {
  return `var(${colourProperties[role]})`;
}

const colourBlock = (palette: Palette, indent: string): string => {
  const byRole: Record<string, Colour> = palette;
  return Object.entries(colourProperties)
    .map(([role, property]) => `${indent}${property}: ${byRole[role]};`)
    .join('\n');
};

/**
 * The tokens as the custom properties the studio's CSS modules read, for
 * injection once at the app root: the light table on the root, the dark one
 * over it under the system's dark preference, so nothing below the root
 * learns which mode it is in. `color-scheme` rides along, which is what makes
 * a scrollbar and a native control follow the same preference.
 *
 * One function over a palette writes both blocks, so a property cannot reach
 * one table and miss the other. The headless render reads neither:
 * `canvasStylesheet` resolves its colours to values, the standalone SVG
 * having no document around it to hold a `:root`.
 */
export const tokenStylesheet = `:root {
  color-scheme: light dark;

  --pn-font-family: ${uiType.family};
  --pn-font-size: ${uiType.size};
  --pn-line-height: ${uiType.lineHeight};

${colourBlock(lightPalette, '  ')}

  --pn-space-1: ${spacingScale[1]};
  --pn-space-2: ${spacingScale[2]};
  --pn-space-3: ${spacingScale[3]};
  --pn-space-4: ${spacingScale[4]};

  --pn-radius: ${radius};

  --pn-focus-ring-width: ${focusRing.width};
  --pn-focus-ring: var(--pn-focus-ring-width) solid var(--pn-colour-accent);
  --pn-focus-ring-offset: ${focusRing.offset};
}

@media (prefers-color-scheme: dark) {
  :root {
${colourBlock(darkPalette, '    ')}
  }
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
 * One colour as a browser writes it back out of a computed style, which is
 * `rgb(r, g, b)` over the same channels. A spec that reads a rendered colour
 * compares against this rather than against the hex a sheet was written in.
 */
export function rgbColour(colour: Colour): string {
  const [red, green, blue] = channels(colour);
  return `rgb(${red}, ${green}, ${blue})`;
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
