import { tokenStylesheet } from '@saerskriven/canvas';

/**
 * The design tokens, as the custom properties every CSS module in the studio
 * reads. They are injected here rather than written in `styles.css` because
 * the values are the canvas package's: the chrome and the diagram inside it
 * are coloured from one table, and a stylesheet here would be a copy of it
 * that nothing keeps in step.
 *
 * The sheet carries the light table and the dark one, the second under
 * `prefers-color-scheme: dark`, so the whole of the mode switch is these
 * properties resolving to other values and no component below asks which
 * mode it is in.
 */
export function DesignTokens() {
  return <style>{tokenStylesheet}</style>;
}
