import { model } from '@panoptes/model';
import styles from './canvas.module.css';

export function PanoptesCanvas() {
  // data-testid is the stable hook for the e2e smoke spec: the CSS module
  // class name is hashed, so it cannot anchor a selector.
  return (
    <div className={styles['container']} data-testid="canvas-container">
      {model()}
    </div>
  );
}
