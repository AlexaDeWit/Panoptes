import {
  assumptionStatusSchema,
  mitigationStatusSchema,
  severitySchema,
  threatFlagSchema,
  threatStatusSchema,
} from '@saerskriven/model';
import { z } from 'zod';
import { lightPalette, strokeWidths, type Colour } from './tokens.js';

const colourSchema = z
  .string()
  .regex(/^#(?:[\da-f]{3}|[\da-f]{6})$/iu)
  .transform((value): Colour => {
    const digits = value.slice(1);
    return `#${digits.length === 3 ? digits.replace(/./gu, '$&$&') : digits}`;
  });

const fontSchema = z.string().regex(/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,79}$/u);

/** Declarative appearance shared by drawings and registers. */
export const renderThemeSchema = z.object({
  severity: z.object({
    low: colourSchema,
    medium: colourSchema,
    high: colourSchema,
    critical: colourSchema,
    undecided: colourSchema,
  }),
  status: z.object({
    open: colourSchema,
    mitigated: colourSchema,
    transferred: colourSchema,
    avoided: colourSchema,
    'accepted-risk': colourSchema,
    eliminated: colourSchema,
    'not-applicable': colourSchema,
  }),
  mitigation: z.object({
    proposed: colourSchema,
    implemented: colourSchema,
    verified: colourSchema,
  }),
  assumption: z.object({
    unconfirmed: colourSchema,
    valid: colourSchema,
    invalidated: colourSchema,
  }),
  flag: z.object({
    'mitigated-without-implemented-work': colourSchema,
    'rests-on-invalidated-assumption': colourSchema,
  }),
  colours: z.object({
    background: colourSchema,
    text: colourSchema,
    muted: colourSchema,
    element: colourSchema,
    actor: colourSchema,
    process: colourSchema,
  }),
  fonts: z.object({ body: fontSchema, code: fontSchema }),
  badges: z.object({
    style: z.enum(['filled', 'outline']),
    text: z.union([colourSchema, z.literal('auto')]),
    borderWidth: z.number().min(0).max(3),
  }),
});

/** A complete theme, after partial overrides have been resolved. */
export type RenderTheme = z.infer<typeof renderThemeSchema>;

/** Light defaults reuse the canvas palette for every semantic colour. */
export const defaultRenderTheme: RenderTheme = {
  severity: {
    low: lightPalette.toneLow,
    medium: lightPalette.toneMedium,
    high: lightPalette.toneHigh,
    critical: lightPalette.toneCritical,
    undecided: lightPalette.toneNeutral,
  },
  status: {
    open: lightPalette.toneCritical,
    mitigated: lightPalette.toneLow,
    transferred: lightPalette.toneMedium,
    avoided: lightPalette.toneLow,
    'accepted-risk': lightPalette.toneHigh,
    eliminated: lightPalette.toneLow,
    'not-applicable': lightPalette.toneNeutral,
  },
  mitigation: {
    proposed: lightPalette.toneNeutral,
    implemented: lightPalette.toneMedium,
    verified: lightPalette.toneLow,
  },
  assumption: {
    unconfirmed: lightPalette.toneNeutral,
    valid: lightPalette.toneLow,
    invalidated: lightPalette.toneCritical,
  },
  flag: {
    'mitigated-without-implemented-work': lightPalette.toneHigh,
    'rests-on-invalidated-assumption': lightPalette.toneCritical,
  },
  colours: {
    background: lightPalette.surfaceCanvas,
    text: lightPalette.textPrimary,
    muted: lightPalette.textSecondary,
    element: lightPalette.surfacePanel,
    actor: lightPalette.surfaceActor,
    process: lightPalette.surfaceProcess,
  },
  fonts: { body: 'Liberation Sans', code: 'Liberation Mono' },
  badges: {
    style: 'filled',
    text: 'auto',
    borderWidth: strokeWidths.badgeRing,
  },
};

const semanticBase = z.object({});

/**
 * Semantic badge identity stays separate from its readable label. Each kind
 * names the theme section its colour comes from.
 */
export const registerBadgeSchema = z.discriminatedUnion('kind', [
  semanticBase.extend({ kind: z.literal('severity'), value: severitySchema }),
  semanticBase.extend({ kind: z.literal('status'), value: threatStatusSchema }),
  semanticBase.extend({
    kind: z.literal('mitigation'),
    value: mitigationStatusSchema,
  }),
  semanticBase.extend({
    kind: z.literal('assumption'),
    value: assumptionStatusSchema,
  }),
  semanticBase.extend({ kind: z.literal('flag'), value: threatFlagSchema }),
]);

/** The semantic colour assigned to one generated label. */
export type RegisterBadge = z.infer<typeof registerBadgeSchema>;

/** Every badge kind, which is also the theme section holding its colours. */
export const registerBadgeKinds = registerBadgeSchema.options.map(
  (option) => option.shape.kind.value,
);

/** Resolves a semantic role without reading its display text. */
export function badgeColour(theme: RenderTheme, badge: RegisterBadge): Colour {
  if (badge.kind === 'severity') {
    return theme.severity[badge.value];
  }
  if (badge.kind === 'status') {
    return theme.status[badge.value];
  }
  if (badge.kind === 'mitigation') {
    return theme.mitigation[badge.value];
  }
  if (badge.kind === 'assumption') {
    return theme.assumption[badge.value];
  }
  return theme.flag[badge.value];
}

/** Automatic lettering follows the semantic tone on outlined badges. */
export function badgeTextColour(theme: RenderTheme, tone: Colour): Colour {
  return theme.badges.text === 'auto'
    ? theme.badges.style === 'outline'
      ? tone
      : lightPalette.badgeGround
    : theme.badges.text;
}
