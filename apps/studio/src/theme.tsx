import { tokenStylesheet } from '@panoptes/canvas';

/**
 * The design tokens, as the custom properties every CSS module in the studio
 * reads. They are injected here rather than written in `styles.css` because
 * the values are the canvas package's: the chrome and the diagram inside it
 * are coloured from one table, and a stylesheet here would be a copy of it
 * that nothing keeps in step.
 */
export function DesignTokens() {
  return <style>{tokenStylesheet}</style>;
}
