import {
  EnterFullScreenIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@radix-ui/react-icons';
import { IconCommandButton } from '../commands/command-button.js';
import styles from './zoom-cluster.module.css';

/** The zoom and fit controls over the canvas. */
export function ZoomCluster() {
  return (
    <section aria-label="Zoom and fit" className={styles.cluster}>
      <IconCommandButton className={styles.control} command="zoom-in">
        <ZoomInIcon aria-hidden="true" className={styles.glyph} />
      </IconCommandButton>
      <IconCommandButton className={styles.control} command="zoom-out">
        <ZoomOutIcon aria-hidden="true" className={styles.glyph} />
      </IconCommandButton>
      <IconCommandButton className={styles.control} command="fit-to-view">
        <EnterFullScreenIcon aria-hidden="true" className={styles.glyph} />
      </IconCommandButton>
    </section>
  );
}
