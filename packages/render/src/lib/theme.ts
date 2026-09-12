import {
  defaultRenderTheme,
  renderThemeSchema,
  type RenderTheme,
} from '@saerskriven/canvas';
import { z } from 'zod';

export {
  defaultRenderTheme,
  renderThemeSchema,
  type RenderTheme,
} from '@saerskriven/canvas';

/** A non-fatal limitation in a consumer's appearance request. */
export const themeDiagnosticSchema = z.object({
  key: z.string(),
  message: z.string(),
});

/** The accepted theme and every ignored entry. */
export const themeReadSchema = z.object({
  theme: renderThemeSchema,
  diagnostics: z.array(themeDiagnosticSchema),
});

/** Best-effort reading always returns a complete usable theme. */
export type ThemeRead = z.infer<typeof themeReadSchema>;

const mappingSchema = z.record(z.string(), z.unknown());

/** Applies valid leaves independently and reports unknown or invalid entries. */
export function readThemeOverrides(value: unknown): ThemeRead {
  const mapping = mappingSchema.safeParse(value);
  if (!mapping.success) {
    return {
      theme: defaultRenderTheme,
      diagnostics: [{ key: '', message: 'expected a mapping, using defaults' }],
    };
  }
  const diagnostics: ThemeRead['diagnostics'] = [];
  const kept: Record<string, Record<string, unknown>> = {};
  for (const section of renderThemeSchema.keyof().options) {
    const schema = renderThemeSchema.shape[section];
    const defaults = defaultRenderTheme[section];
    kept[section] = { ...defaults };
    if (!Object.hasOwn(mapping.data, section)) continue;
    const entries = mappingSchema.safeParse(mapping.data[section]);
    if (!entries.success) {
      diagnostics.push({
        key: section,
        message: 'expected a mapping, using defaults',
      });
      continue;
    }
    const fields: Readonly<Record<string, z.ZodType>> = schema.shape;
    for (const [key, entry] of Object.entries(entries.data)) {
      const field = Object.hasOwn(fields, key) ? fields[key] : undefined;
      const parsed = field?.safeParse(entry);
      if (parsed?.success === true) kept[section][key] = parsed.data;
      else
        diagnostics.push({
          key: `${section}.${key}`,
          message:
            field === undefined
              ? 'unknown key, ignored'
              : 'invalid value, using default',
        });
    }
  }
  for (const key of Object.keys(mapping.data)) {
    if (!Object.hasOwn(renderThemeSchema.shape, key))
      diagnostics.push({ key, message: 'unknown key, ignored' });
  }
  const parsed = renderThemeSchema.safeParse(kept);
  return {
    theme: parsed.success ? parsed.data : defaultRenderTheme,
    diagnostics,
  };
}

/** Uses bundled font families for raster and PDF output, reporting substitutions. */
export function withBundledFonts(theme: RenderTheme): ThemeRead {
  const diagnostics: ThemeRead['diagnostics'] = [];
  const fonts = { ...theme.fonts };
  for (const key of ['body', 'code'] as const) {
    if (!['Liberation Sans', 'Liberation Mono'].includes(fonts[key])) {
      diagnostics.push({
        key: `fonts.${key}`,
        message: `${fonts[key]} is not bundled, using ${defaultRenderTheme.fonts[key]}`,
      });
      fonts[key] = defaultRenderTheme.fonts[key];
    }
  }
  return { theme: { ...theme, fonts }, diagnostics };
}
