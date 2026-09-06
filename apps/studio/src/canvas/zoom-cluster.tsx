import type { ReactNode } from 'react';
import { IconCommandButton } from '../commands/command-button.js';
import styles from './zoom-cluster.module.css';

const glyph = (drawn: string): ReactNode => (
  <svg aria-hidden="true" className={styles.glyph} viewBox="0 0 16 16">
    <path d={drawn} />
  </svg>
);

/**
 * Zoom in, zoom out and fit to view, floating over the bottom right corner of
 * the canvas. Each is one registered command drawn as an icon, so a click and
 * the chord run one dispatch and the tooltip says which chord that is ([the
 * commands](../commands/README.md)). The fit is the one an open performs, so
 * pressing it over a diagram that was just opened moves nothing.
 */
export function ZoomCluster() {
  return (
    <section aria-label="Zoom and fit" className={styles.cluster}>
      <IconCommandButton className={styles.control} command="zoom-in">
        {glyph('M8 3.5v9M3.5 8h9')}
      </IconCommandButton>
      <IconCommandButton className={styles.control} command="zoom-out">
        {glyph('M3.5 8h9')}
      </IconCommandButton>
      <IconCommandButton className={styles.control} command="fit-to-view">
        {glyph('M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4')}
      </IconCommandButton>
    </section>
  );
}
