import {
  lightPalette,
  defaultRenderTheme,
  registerBadgeKinds,
  type RenderTheme,
} from '@saerskriven/canvas';

/** Stable classes identify generated content independently of the stylesheet. */
export const registerClassNames = {
  root: 'saer-register',
  badge: 'saer-badge',
  label: 'saer-badge-label',
} as const;

/** CSS stays within the generated register and exposes appearance as custom properties. */
export function registerStylesheet(
  theme: RenderTheme = defaultRenderTheme,
): string {
  const properties = [
    ...Object.entries(theme.colours).map(
      ([key, value]) => `  --saer-${key}: ${value};`,
    ),
    ...Object.entries(theme.fonts).map(
      ([key, value]) => `  --saer-font-${key}: ${JSON.stringify(value)};`,
    ),
    ...registerBadgeKinds.flatMap((kind) =>
      Object.entries(theme[kind]).map(
        ([key, value]) => `  --saer-${kind}-${key}: ${value};`,
      ),
    ),
    ...(theme.badges.text === 'auto' && theme.badges.style === 'outline'
      ? []
      : [
          `  --saer-badge-text: ${theme.badges.text === 'auto' ? lightPalette.badgeGround : theme.badges.text};`,
        ]),
    `  --saer-badge-border-width: ${String(theme.badges.borderWidth)}px;`,
    ...(theme.badges.style === 'outline'
      ? ['  --saer-badge-background: transparent;']
      : []),
    '  --saer-badge-radius: 0.2em;',
    '  --saer-badge-padding: 0.1em 0.35em;',
  ];
  const root = `.${registerClassNames.root}`;
  const roles = registerBadgeKinds.flatMap((kind) =>
    Object.keys(theme[kind]).map(
      (value) =>
        `:where(${root} .saer-${kind}-${value}) { --saer-tone: var(--saer-${kind}-${value}); }`,
    ),
  );
  return `:where(${root}) {
${properties.join('\n')}
  color: var(--saer-text);
  background: var(--saer-background);
  font-family: var(--saer-font-body), sans-serif;
}
:where(${root} code), :where(${root} pre) { font-family: var(--saer-font-code), monospace; }
:where(${root} .${registerClassNames.badge}) {
  display: inline-block;
  background: var(--saer-badge-background, var(--saer-tone));
  color: var(--saer-badge-colour, var(--saer-badge-text, var(--saer-tone)));
  border: var(--saer-badge-border-width) solid var(--saer-tone);
  border-radius: var(--saer-badge-radius);
  padding: var(--saer-badge-padding);
  white-space: nowrap;
}
${roles.join('\n')}
`;
}
