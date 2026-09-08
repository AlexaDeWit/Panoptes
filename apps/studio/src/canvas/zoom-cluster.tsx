import {
  EnterFullScreenIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@radix-ui/react-icons';
import { useViewport } from '@xyflow/react';
import { IconCommandButton } from '../commands/command-button.js';
import styles from './zoom-cluster.module.css';

/** The zoom and fit controls over the canvas. */
export function ZoomCluster() {
  const { zoom } = useViewport();
  return (
    <section aria-label="Zoom and fit" className={styles.cluster}>
      <IconCommandButton className={styles.control} command="zoom-in">
        <ZoomInIcon aria-hidden="true" className={styles.glyph} />
      </IconCommandButton>
      <IconCommandButton className={styles.control} command="zoom-out">
        <ZoomOutIcon aria-hidden="true" className={styles.glyph} />
      </IconCommandButton>
      <IconCommandButton className={styles.percentage} command="reset-zoom">
        <span>{Math.round(zoom * 100)}%</span>
      </IconCommandButton>
      <IconCommandButton className={styles.control} command="fit-selection">
        <span aria-hidden="true">⊡</span>
      </IconCommandButton>
      <IconCommandButton className={styles.control} command="fit-to-view">
        <EnterFullScreenIcon aria-hidden="true" className={styles.glyph} />
      </IconCommandButton>
    </section>
  );
}
