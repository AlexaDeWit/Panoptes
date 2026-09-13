import {
  badgeColour,
  defaultRenderTheme,
  registerBadgeKinds,
  registerBadgeSchema,
  renderThemeSchema,
  type RenderTheme,
} from './render-theme.js';

const badgeRoles = registerBadgeKinds.flatMap((kind) =>
  Object.keys(defaultRenderTheme[kind]).map((value) => ({ kind, value })),
);

const distinctColour = (index: number): string =>
  `#${index.toString(16).padStart(6, '0')}`;

const distinctTheme: RenderTheme = renderThemeSchema.parse({
  ...defaultRenderTheme,
  ...Object.fromEntries(
    registerBadgeKinds.map((kind) => [
      kind,
      Object.fromEntries(
        badgeRoles.flatMap((role, index) =>
          role.kind === kind ? [[role.value, distinctColour(index + 1)]] : [],
        ),
      ),
    ]),
  ),
});

describe('badgeColour', () => {
  it.each(badgeRoles.map((role, index) => ({ ...role, index })))(
    'resolves the $kind badge $value from its own theme section',
    ({ kind, value, index }) => {
      expect(
        badgeColour(distinctTheme, registerBadgeSchema.parse({ kind, value })),
      ).toBe(distinctColour(index + 1));
    },
  );
});
